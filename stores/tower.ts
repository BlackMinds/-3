// 通天塔状态管理
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export interface TowerInfo {
  max_floor: number
  next_floor: number
  daily_fail_used: number
  daily_fail_max: number
  can_challenge: boolean
  can_sweep: boolean
  total_floors: number
  implemented_floors: number
  eligible: boolean
  entry_realm_tier: number
  entry_level: number
  current_realm_tier: number
  current_level: number
}

export interface TowerTraitInfo {
  id: string
  name: string
  desc: string
  category: string
}

export interface TowerMonsterPreview {
  name: string
  element: string | null
  role: string
  power: number
  traits: TowerTraitInfo[]
}

export interface TowerFloorPreview {
  floor: number
  name: string
  is_layer_lord: boolean
  is_mid_boss: boolean
  is_final_boss: boolean
  is_cleared: boolean
  reward_title: string | null
  permanent_stat_pct: number
  design_note: string
  monsters: TowerMonsterPreview[]
}

export interface TowerBattleHistory {
  id: number
  floor: number
  result: 'victory' | 'defeat'
  total_turns: number
  damage_dealt: number
  damage_taken: number
  created_at: string
}

export interface TowerBattleResult {
  id: number
  floor: number
  result: 'victory' | 'defeat'
  total_turns: number
  damage_dealt: number
  damage_taken: number
  logs: any[]
  monsters_info: any[]
  is_first_clear: boolean
  unlocked_title: string | null
  permanent_bonus_pct: number
  purple_skill_drops?: { skill_id: string; name: string; element: string | null }[]
}

export const useTowerStore = defineStore('tower', () => {
  const info = ref<TowerInfo | null>(null)
  const previewByFloor = ref<Record<number, TowerFloorPreview>>({})
  const recentBattles = ref<TowerBattleHistory[]>([])

  // 当前选择的层（0 = 未初始化；首次 fetchInfo 后会被设为 next_floor）
  const selectedFloor = ref<number>(0)

  // 战斗中状态
  const isFighting = ref(false)
  const lastResult = ref<TowerBattleResult | null>(null)
  const isReplay = ref(false)

  // 失败/胜利展示用
  const showResultBar = ref(false)
  // 胜利后倒计时（秒）
  const autoChallengeCountdown = ref(0)

  // 快速战斗（勾上 = 跳过日志播放直接结算；不勾 = 战斗后逐条播放日志到 game.battleLogs）
  // 持久化到 localStorage，玩家偏好跨会话保留
  const fastBattle = ref<boolean>(loadFastBattle())
  function loadFastBattle(): boolean {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('xiantu_tower_fast_battle') === '1' } catch { return false }
  }
  watch(fastBattle, (v) => {
    try { localStorage.setItem('xiantu_tower_fast_battle', v ? '1' : '0') } catch {}
  })

  // 日志播放定时器（避免重复挂载）
  let logPlayTimer: number | null = null
  function clearLogPlayTimer() {
    if (logPlayTimer != null) { clearInterval(logPlayTimer); logPlayTimer = null }
  }

  function getAuthHeaders() {
    const userStore = useUserStore()
    return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
  }

  async function fetchApi<T = any>(url: string, options: any = {}): Promise<T> {
    return $fetch<T>(url, {
      baseURL: '/api',
      headers: getAuthHeaders(),
      ...options,
    })
  }

  // ===== Actions =====
  async function fetchInfo() {
    try {
      const res = await fetchApi<{ code: number; data: TowerInfo }>('/tower/info')
      if (res.code === 200) {
        info.value = res.data
        // 初次拉取或玩家进塔时，把选层默认设为 next_floor
        if (selectedFloor.value < 1 || selectedFloor.value > res.data.next_floor) {
          selectedFloor.value = res.data.next_floor
        }
      }
      return res
    } catch (e) {
      console.error('fetchInfo 失败', e)
      return { code: 500, data: null as any }
    }
  }

  async function fetchFloor(floor: number) {
    if (previewByFloor.value[floor]) return previewByFloor.value[floor]
    try {
      const res = await fetchApi<{ code: number; data: TowerFloorPreview }>(`/tower/floor/${floor}`)
      if (res.code === 200) {
        previewByFloor.value[floor] = res.data
        return res.data
      }
    } catch (e) {
      console.error('fetchFloor 失败', e)
    }
    return null
  }

  async function challenge(floor: number): Promise<{ code: number; data?: any; message?: string }> {
    if (isFighting.value) return { code: 429, message: '战斗进行中' }
    clearLogPlayTimer()
    isFighting.value = true
    showResultBar.value = false
    try {
      const res = await fetchApi<{ code: number; data?: any; message?: string }>('/tower/challenge', {
        method: 'POST',
        body: { floor },
      })
      if (res.code === 200 && res.data) {
        const battle = res.data.battle as TowerBattleResult
        isReplay.value = !!res.data.is_replay
        // 同步状态
        if (info.value) {
          info.value.max_floor = res.data.state_after.max_floor
          info.value.daily_fail_used = res.data.state_after.daily_fail_used
          info.value.can_challenge = res.data.state_after.can_challenge
          info.value.next_floor = Math.min(info.value.implemented_floors, info.value.max_floor + 1)
        }

        // 播放日志：勾选"快速战斗"则跳过；否则复用 game store 的 HUD + 日志播放机制
        if (!fastBattle.value && Array.isArray(battle.logs) && battle.logs.length > 0) {
          const gs = useGameStore() as any
          if (gs?.clearLogs) gs.clearLogs()

          // 构造 game store 期望的 battle entry：把通天塔的 monsters_info 映射成 hud 字段
          const monstersInfo = (battle as any).monsters_info || []
          const monsterNames = monstersInfo.map((m: any) => m.name)
          const monstersMaxHp = monstersInfo.map((m: any) => m.maxHp)
          const monsterInfo = monstersInfo[0] || null
          gs.applyTowerBattleEntry({
            monsterNames,
            monstersMaxHp,
            monsterInfo,
            monstersInfo,
            logs: battle.logs,
          })

          // 等播放完毕（onBattleLogsFinished 会清 inFight）
          await new Promise<void>(resolve => {
            const tick = window.setInterval(() => {
              // 玩家中途取消 / 战斗未在进行 → 停
              if (!gs.inFight || !isFighting.value) {
                clearInterval(tick)
                resolve()
              }
            }, 200)
            logPlayTimer = tick as unknown as number
          })
        }

        lastResult.value = battle
        showResultBar.value = true
      }
      return res
    } catch (e: any) {
      console.error('challenge 失败', e)
      return { code: 500, message: e?.message || '请求失败' }
    } finally {
      clearLogPlayTimer()
      isFighting.value = false
    }
  }

  async function fetchBattles(limit = 20) {
    try {
      const res = await fetchApi<{ code: number; data: { battles: TowerBattleHistory[] } }>(`/tower/battles?limit=${limit}`)
      if (res.code === 200) {
        recentBattles.value = res.data.battles
      }
    } catch (e) {
      console.error('fetchBattles 失败', e)
    }
  }

  async function sweep(): Promise<{ code: number; data?: any; message?: string }> {
    try {
      const res = await fetchApi<{ code: number; data?: any; message?: string }>('/tower/sweep', { method: 'POST' })
      if (res.code === 200 && info.value) {
        info.value.can_sweep = false
      }
      return res
    } catch (e: any) {
      console.error('sweep 失败', e)
      return { code: 500, message: e?.message || '请求失败' }
    }
  }

  function dismissResultBar() {
    showResultBar.value = false
    lastResult.value = null
    autoChallengeCountdown.value = 0
    clearLogPlayTimer()
  }

  // ===== 派生状态 =====
  const eligible = computed(() => info.value?.eligible || false)
  const canChallenge = computed(() => info.value?.can_challenge || false)
  const maxFloor = computed(() => info.value?.max_floor || 0)
  const nextFloor = computed(() => info.value?.next_floor || 1)
  const implementedFloors = computed(() => info.value?.implemented_floors || 25)
  const dailyFailUsed = computed(() => info.value?.daily_fail_used || 0)
  const dailyFailMax = computed(() => info.value?.daily_fail_max || 3)

  /** 玩家可选择的层数列表（1 ~ next_floor），用于下拉框 */
  const selectableFloors = computed(() => {
    if (!info.value) return []
    const max = info.value.next_floor
    const list: { floor: number; cleared: boolean; isNext: boolean }[] = []
    for (let i = 1; i <= max; i++) {
      list.push({
        floor: i,
        cleared: i <= info.value.max_floor,
        isNext: i === info.value.next_floor && info.value.max_floor < info.value.implemented_floors,
      })
    }
    return list
  })

  const canSweep = computed(() => info.value?.can_sweep || false)

  return {
    info, previewByFloor, recentBattles,
    selectedFloor,
    isFighting, lastResult, isReplay,
    showResultBar, autoChallengeCountdown,
    fastBattle,
    fetchInfo, fetchFloor, challenge, fetchBattles, sweep,
    dismissResultBar,
    eligible, canChallenge, canSweep, maxFloor, nextFloor, implementedFloors,
    dailyFailUsed, dailyFailMax, selectableFloors,
  }
})
