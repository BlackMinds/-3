import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CharacterData, BattleLogEntry, MapData, MonsterBattleInfo } from '~/game/types'
import { MAPS, getRealmName, getExpRequired, getUnlockedMaps } from '~/game/data'

export const useGameStore = defineStore('game', () => {
  // ===== 角色数据 =====
  const character = ref<CharacterData | null>(null)
  const loaded = ref(false)

  // ===== 战斗状态 =====
  const battleLogs = ref<BattleLogEntry[]>([])
  const isBattling = ref(false)
  const currentMapId = ref('qingfeng_valley')
  const battleTimer = ref<number | null>(null)
  const killCount = ref(0)
  const sessionExp = ref(0)
  const sessionStone = ref(0)

  // 战斗中血条状态
  const displayPlayerHp = ref(0)
  const displayPlayerMaxHp = ref(0)
  const displayMonsterHp = ref(0)
  const displayMonsterMaxHp = ref(0)
  const currentMonsterInfo = ref<MonsterBattleInfo | null>(null)
  const waveMonsterNames = ref<string[]>([])
  const waveMonsterHps = ref<number[]>([])
  const waveMonsterMaxHps = ref<number[]>([])
  const inFight = ref(false)
  // 只在 fetch 真正返回前为 true；独立于 inFight（UI 语义），专防并发 fetch
  const fetchInFlight = ref(false)
  // 最近一次 stopBattle 的时间戳，用于"反复切开始/离开刷怪"节流
  const lastStopAt = ref(0)
  // 上一场战斗日志预期播完的时间戳。logQueue 每 1s shift 一条 → 结束时间 = 发起时 + logs.length * 1000
  // stopBattle 不清除本值，用于守卫"上场战斗未播完就又开打"（和实际日志长度联动，短战斗短守卫、长战斗长守卫）
  const expectedBattleEndAt = ref(0)
  const LOG_INTERVAL_MS = 1000
  // 上次 startBattle 调用时刻，兜底守卫：即便 fight 请求还没发出就被 stopBattle，也至少拦 START_GUARD_MS
  const lastStartAt = ref(0)
  const START_GUARD_MS = 2000

  // 死亡冷却
  const deathCooldown = ref(0)
  const deathTimer = ref<number | null>(null)

  // 日志队列
  const logQueue = ref<BattleLogEntry[]>([])
  const logTimer = ref<number | null>(null)
  const pendingResult = ref<{ won: boolean; expGained: number; spiritStoneGained: number; drops: any[] } | null>(null)
  // 每次 stopBattle/changeMap 递增，executeFight 用来丢弃过期响应，避免并发请求污染状态
  const battleSession = ref(0)

  // 批量战斗：单次请求拿回 N 场，依次播放完才发下一批，省 Function 调用与连接开销
  const BATCH_COUNT = 10
  const batchQueue = ref<any[]>([])

  const sessionDrops = ref<Record<string, number>>({})
  const equippedSkills = ref<any>(null)
  const battleFrenzyStacks = ref(0)

  const caveBonus = ref({
    expBonus: 0,
    skillRate: 0,
    craftRate: 0,
    equipQuality: 0,
  })

  const activeTab = ref<'battle' | 'character' | 'skills' | 'equip' | 'cultivate' | 'cave' | 'sect'>('battle')

  // ===== 内部 API 调用 =====
  function getAuthHeaders() {
    const userStore = useUserStore()
    return {
      Authorization: userStore.token ? `Bearer ${userStore.token}` : '',
    }
  }

  async function fetchApi<T = any>(url: string, options: any = {}): Promise<T> {
    return $fetch<T>(url, {
      baseURL: '/api',
      headers: getAuthHeaders(),
      ...options,
    })
  }

  // ===== 计算属性 =====
  const currentMap = computed<MapData | undefined>(() =>
    MAPS.find(m => m.id === currentMapId.value)
  )

  const unlockedMaps = computed(() => {
    if (!character.value) return MAPS.slice(0, 1)
    return getUnlockedMaps(character.value.realm_tier || 1, character.value.realm_stage || 1)
  })

  const realmName = computed(() => {
    if (!character.value) return ''
    return getRealmName(character.value.realm_tier || 1, character.value.realm_stage || 1)
  })

  const expRequired = computed(() => {
    if (!character.value) return 0
    return getExpRequired(character.value.realm_tier || 1, character.value.realm_stage || 1)
  })

  const expPercent = computed(() => {
    if (!character.value || expRequired.value === 0) return 0
    return Math.min(100, (character.value.cultivation_exp / expRequired.value) * 100)
  })

  const charLevel = computed(() => Math.min(200, character.value?.level || 1))

  const levelExpRequired = computed(() => {
    const lv = charLevel.value
    if (lv >= 200) return Infinity
    // 经验曲线整体降档: 前30级 -33%, 150+ 段指数从 1.5 降至 1.48 让 Lv.200 可达
    if (lv <= 30) return Math.floor(60 * Math.pow(lv, 1.25))
    if (lv <= 80) return Math.floor(100 * Math.pow(lv, 1.35))
    if (lv <= 150) return Math.floor(180 * Math.pow(lv, 1.42))
    return Math.floor(320 * Math.pow(lv, 1.48))
  })

  const levelExpPercent = computed(() => {
    if (!character.value || levelExpRequired.value === 0 || levelExpRequired.value === Infinity) return charLevel.value >= 200 ? 100 : 0
    return Math.min(100, (character.value.level_exp / levelExpRequired.value) * 100)
  })

  const levelBonus = computed(() => {
    const lv = charLevel.value
    let hp = 0, atk = 0, def = 0, spd = 0
    for (let i = 1; i < lv; i++) {
      if (i <= 50)       { hp += 5;  atk += 2;  def += 1; spd += 1 }
      else if (i <= 100) { hp += 10; atk += 4;  def += 2; spd += 2 }
      else if (i <= 150) { hp += 20; atk += 8;  def += 4; spd += 3 }
      else               { hp += 40; atk += 15; def += 8; spd += 5 }
    }
    return { hp, atk, def, spd }
  })

  // ===== 方法 =====
  async function loadGameData() {
    try {
      const res: any = await fetchApi('/game/data')
      if (res.code === 200 && res.data) {
        character.value = res.data
        // 只在首次加载时从 DB 同步当前地图；后续调用不覆盖前端选择，
        // 避免 loadGameData（被多处动作触发）把玩家从刚切换的地图拉回 DB 里的旧值
        if (!loaded.value && res.data.current_map) {
          currentMapId.value = res.data.current_map
        }
        loaded.value = true
      }
      return res
    } catch (e) {
      console.error('加载游戏数据失败', e)
    }
  }

  function changeMap(mapId: string) {
    if (currentMapId.value === mapId) return
    currentMapId.value = mapId
    battleFrenzyStacks.value = 0
    addLog(0, `你前往了【${currentMap.value?.name}】`, 'system')
    // 立即持久化新地图到 DB，避免非战斗中切图时 DB 保留旧值，
    // 进而被后续 loadGameData（如果被绕开 loaded 保护）拉回
    fetchApi('/game/update-character', {
      method: 'POST',
      body: { current_map: mapId },
    }).catch(() => {})
    if (isBattling.value) {
      stopBattle()
      startBattle()
    }
  }

  function startBattle() {
    if (!character.value || !currentMap.value) return
    if (isBattling.value) {
      addLog(0, '已在战斗中', 'system')
      return
    }
    if (fetchInFlight.value) {
      addLog(0, '上场战斗未结束，请稍候', 'system')
      return
    }
    const now = Date.now()
    if (now < expectedBattleEndAt.value) {
      addLog(0, '上场战斗未结束，请稍候', 'system')
      return
    }
    // 兜底：即便上次 fight 请求未真正发出（被 setTimeout 延迟后又被 stop 清掉），
    // 也至少拦 START_GUARD_MS，避免"开始→立刻离开→立刻开始"完全无守卫
    if (lastStartAt.value > 0 && now - lastStartAt.value < START_GUARD_MS) {
      addLog(0, '上场战斗未结束，请稍候', 'system')
      return
    }
    lastStartAt.value = now
    isBattling.value = true
    sessionDrops.value = {}
    addLog(0, `在【${currentMap.value.name}】开始历练…`, 'system')
    // 反复「开始/离开」节流：若距上次 stop 不到 1.5s（对齐 server BATTLE_COOLDOWN_MS），延迟首次 fight，防止通过快速切换把刷怪频率拉到冷却极限
    const elapsed = Date.now() - lastStopAt.value
    const MANUAL_RESTART_COOLDOWN = 1500
    if (battleTimer.value) { clearTimeout(battleTimer.value); battleTimer.value = null }
    if (elapsed < MANUAL_RESTART_COOLDOWN) {
      battleTimer.value = window.setTimeout(() => scheduleFight(), MANUAL_RESTART_COOLDOWN - elapsed)
    } else {
      scheduleFight()
    }
  }

  function stopBattle() {
    isBattling.value = false
    battleSession.value++
    lastStopAt.value = Date.now()
    // 缩短守卫：批次剩余场次会被丢弃不再播放，不应阻挡新战斗。仅保留当前正在播放的剩余 + 冷却。
    const currentRemainingMs = logQueue.value.length * LOG_INTERVAL_MS
    const tighten = Date.now() + currentRemainingMs + 1500
    if (tighten < expectedBattleEndAt.value) {
      expectedBattleEndAt.value = tighten
    }
    if (battleTimer.value) { clearTimeout(battleTimer.value); battleTimer.value = null }
    if (logTimer.value) { clearInterval(logTimer.value); logTimer.value = null }
    if (deathTimer.value) { clearInterval(deathTimer.value); deathTimer.value = null }
    logQueue.value = []
    batchQueue.value = []
    pendingResult.value = null
    inFight.value = false
    // fetchInFlight 不清：让飞行中的请求自然返回时释放，期间 startBattle 被挡住避免并发
    currentMonsterInfo.value = null
    deathCooldown.value = 0
    // 主动停战 = 放弃当前批次的剩余播放，告诉服务端清 battle_end_at，
    // 否则切图/离开立即重开会被 DB 残留的批次守卫（最长 ~90s）拦成连续 409
    flushSave(true)
  }

  function scheduleFight() {
    if (!isBattling.value || deathCooldown.value > 0) return
    if (logQueue.value.length > 0) return
    executeFight()
  }

  // 标签页切回前台时调用：若战斗循环被后台节流/冻结卡死（全空闲但仍 isBattling），强制拉回一次
  function resumeBattleIfStalled() {
    if (!isBattling.value) return
    if (battleTimer.value || logTimer.value || deathTimer.value) return
    if (fetchInFlight.value || inFight.value) return
    if (logQueue.value.length > 0) return
    if (deathCooldown.value > 0) return
    scheduleFight()
  }

  // 把单场战斗数据应用到本地播放状态（队列、怪物信息、HP 显示）
  function applyBattleEntry(b: any) {
    if (!character.value) return
    waveMonsterNames.value = b.monsterNames || []
    waveMonsterMaxHps.value = (b.monsterNames || []).map((_: string, i: number) => b.monstersMaxHp?.[i] ?? (b.monsterInfo?.maxHp ?? 0))
    waveMonsterHps.value = [...waveMonsterMaxHps.value]
    currentMonsterInfo.value = b.monsterInfo || null
    displayPlayerHp.value = character.value.max_hp
    displayPlayerMaxHp.value = character.value.max_hp

    pendingResult.value = {
      won: b.won,
      expGained: b.expGained || 0,
      spiritStoneGained: b.stoneGained || 0,
      drops: b.drops || [],
    }

    logQueue.value = b.logs || []
    inFight.value = true
    drainLogQueue()
  }

  async function executeFight() {
    if (!character.value || !currentMap.value) return
    inFight.value = true
    fetchInFlight.value = true
    const mySession = battleSession.value

    try {
      let autoSell = 'none'
      let autoSellTier = 0
      try {
        const s = JSON.parse(localStorage.getItem('xiantu_settings') || '{}')
        autoSell = s.autoSell || 'none'
        autoSellTier = s.autoSellTier || 0
      } catch {}

      const res: any = await fetchApi('/battle/fight', {
        method: 'POST',
        body: {
          map_id: currentMapId.value,
          auto_sell: autoSell,
          auto_sell_tier: autoSellTier,
          batch_count: BATCH_COUNT,
        },
      })
      // 后端已计算整批 → 不论 session 是否过期，守卫都按全批 logs 总时长设置，
      // 防止"开始→离开→立即开始"在请求返回后 expectedBattleEndAt 未被写入就绕过守卫
      const battles: any[] = res?.code === 200 && Array.isArray(res.data?.battles) ? res.data.battles : []
      const totalLogsLen = battles.reduce((sum, b) => sum + (Array.isArray(b.logs) ? b.logs.length : 0), 0)
      if (totalLogsLen > 0) {
        expectedBattleEndAt.value = Date.now() + totalLogsLen * LOG_INTERVAL_MS
      }
      fetchInFlight.value = false

      // 期间 stopBattle/changeMap 过，这次响应已过期，整包丢弃（后端奖励入库不影响，下次 loadGameData 会同步角色总状态）
      if (mySession !== battleSession.value) {
        inFight.value = false
        return
      }

      if (res.code !== 200) {
        // 429 冷却 / 409 上场未结束 需让用户感知；其他错误按原样打日志
        // 重试延迟 1.5s 与 BATTLE_COOLDOWN_MS 对齐，避免快速切换拉爆请求
        if (res.code === 409) {
          addLog(0, res.message || '上场战斗未结束，请稍候', 'system')
        } else if (res.code === 429) {
          addLog(0, res.message || '战斗冷却中', 'system')
        } else {
          addLog(0, res.message || '战斗请求失败', 'system')
        }
        inFight.value = false
        battleTimer.value = window.setTimeout(() => scheduleFight(), 1500)
        return
      }

      const data = res.data

      if (data.character) {
        character.value = data.character
      }

      if (battles.length === 0) {
        // 兜底：返回 200 但 battles 空（不应发生）
        inFight.value = false
        battleTimer.value = window.setTimeout(() => scheduleFight(), 1500)
        return
      }

      // 第一场立刻播；剩余排进 batchQueue，播完一场切下一场
      batchQueue.value = battles.slice(1)
      applyBattleEntry(battles[0])
    } catch {
      fetchInFlight.value = false
      inFight.value = false
      if (mySession !== battleSession.value) return
      addLog(0, '战斗请求失败', 'system')
      battleTimer.value = window.setTimeout(() => scheduleFight(), 2000)
    }
  }

  function emitLog(log: BattleLogEntry) {
    addLog(log.turn, log.text, log.type)
    if (log.playerHp !== undefined) displayPlayerHp.value = Math.max(0, log.playerHp)
    if (log.playerMaxHp !== undefined) displayPlayerMaxHp.value = log.playerMaxHp
    if (log.monsterHp !== undefined) displayMonsterHp.value = Math.max(0, log.monsterHp)
    if (log.monsterMaxHp !== undefined) displayMonsterMaxHp.value = log.monsterMaxHp
    if (log.monstersHp !== undefined) waveMonsterHps.value = log.monstersHp.map(h => Math.max(0, h))
  }

  function drainLogQueue() {
    if (logTimer.value) { clearInterval(logTimer.value); logTimer.value = null }

    if (logQueue.value.length > 0) {
      emitLog(logQueue.value.shift()!)
    }

    if (logQueue.value.length > 0) {
      logTimer.value = window.setInterval(() => {
        if (logQueue.value.length === 0 || !isBattling.value) {
          if (logTimer.value) clearInterval(logTimer.value)
          logTimer.value = null
          onBattleLogsFinished()
          return
        }
        emitLog(logQueue.value.shift()!)
        if (logQueue.value.length === 0) {
          if (logTimer.value) clearInterval(logTimer.value)
          logTimer.value = null
          onBattleLogsFinished()
        }
      }, 1000)
    } else {
      onBattleLogsFinished()
    }
  }

  function onBattleLogsFinished() {
    if (!character.value || !pendingResult.value) return

    const result = pendingResult.value
    pendingResult.value = null
    inFight.value = false

    if (result.won) {
      killCount.value++
      if (battleFrenzyStacks.value < 10) battleFrenzyStacks.value++
      sessionExp.value += result.expGained
      sessionStone.value += result.spiritStoneGained

      if (result.drops && Array.isArray(result.drops)) {
        result.drops.forEach((dropName: string) => {
          if (dropName) sessionDrops.value[dropName] = (sessionDrops.value[dropName] || 0) + 1
        })
      }
      // 优先消费当前批次剩余战斗，本地直接切下一场，不再发请求
      if (isBattling.value && batchQueue.value.length > 0) {
        const next = batchQueue.value.shift()
        applyBattleEntry(next)
      } else {
        scheduleFight()
      }
    } else {
      // 失败：丢弃批次剩余（后端遇到失败已 break，理论上 batchQueue 已空）
      batchQueue.value = []
      deathCooldown.value = 3
      battleFrenzyStacks.value = 0
      deathTimer.value = window.setInterval(() => {
        deathCooldown.value--
        if (deathCooldown.value <= 0) {
          if (deathTimer.value) clearInterval(deathTimer.value)
          deathTimer.value = null
          addLog(0, '你原地复活了，继续历练', 'system')
          scheduleFight()
        }
      }, 1000)
    }
  }

  /**
   * 手动突破(v3.2): 调用后端 /api/game/breakthrough
   * 返回 { success, rate, lost?, character } 或 null(请求失败)
   */
  async function tryBreakthrough(): Promise<{
    success: boolean
    rate: number
    lost?: number
    penalty?: number
    message: string
    character?: any
  } | null> {
    try {
      const res: any = await fetchApi('/game/breakthrough', { method: 'POST' })
      if (res?.code !== 200) {
        addLog(0, res?.message || '突破请求失败', 'system')
        return null
      }
      const d = res.data
      // 更新本地 character
      if (d.character && character.value) {
        Object.assign(character.value, d.character)
      }
      // 战斗日志
      if (d.success) {
        addLog(0, `【${realmName.value}】${d.crossBigRealm ? '跨入新境界!' : '小境界提升!'}`, 'system')
      } else {
        addLog(0, `突破失败! ${d.message || ''}`, 'system')
      }
      return d
    } catch (err) {
      console.error('突破请求失败', err)
      addLog(0, '网络错误,突破失败', 'system')
      return null
    }
  }

  function addLog(turn: number, text: string, type: BattleLogEntry['type']) {
    battleLogs.value.push({ turn, text, type })
    if (battleLogs.value.length > 200) {
      battleLogs.value.splice(0, battleLogs.value.length - 200)
    }
  }

  function clearLogs() {
    battleLogs.value = []
  }

  function flushSave(clearBattleEnd = false) {
    if (character.value) {
      const body: any = { current_map: currentMapId.value }
      if (clearBattleEnd) body.clear_battle_end = true
      fetchApi('/game/update-character', {
        method: 'POST',
        body,
      }).catch(() => {})
    }
  }

  return {
    character, loaded, battleLogs, isBattling, currentMapId,
    killCount, sessionExp, sessionStone, sessionDrops, equippedSkills, caveBonus, battleFrenzyStacks, deathCooldown, activeTab,
    displayPlayerHp, displayPlayerMaxHp, displayMonsterHp, displayMonsterMaxHp,
    currentMonsterInfo, waveMonsterNames, waveMonsterHps, waveMonsterMaxHps, inFight,
    currentMap, unlockedMaps, realmName, expRequired, expPercent,
    charLevel, levelExpRequired, levelExpPercent, levelBonus,
    loadGameData, changeMap, startBattle, stopBattle, resumeBattleIfStalled, clearLogs, addLog, flushSave, tryBreakthrough,
  }
})
