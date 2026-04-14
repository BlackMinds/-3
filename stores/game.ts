import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CharacterData, BattleLogEntry, MapData, MonsterBattleInfo } from '~/game/types'
import { MAPS, REALM_TIERS, getRealmName, getExpRequired, getUnlockedMaps } from '~/game/data'

export const useGameStore = defineStore('game', () => {
  // ===== 角色数据 =====
  const character = ref<CharacterData | null>(null)
  const loaded = ref(false)

  // ===== 战斗状态 =====
  const battleLogs = ref<BattleLogEntry[]>([])
  const isBattling = ref(false)
  const currentMapId = ref('qingfeng_valley')
  const battleTimer = ref<number | null>(null)
  const isPaused = ref(false)
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
  const inFight = ref(false)

  // 死亡冷却
  const deathCooldown = ref(0)
  const deathTimer = ref<number | null>(null)

  // 日志队列
  const logQueue = ref<BattleLogEntry[]>([])
  const logTimer = ref<number | null>(null)
  const pendingResult = ref<{ won: boolean; expGained: number; spiritStoneGained: number; drops: any[] } | null>(null)

  const saveTimer = ref<number | null>(null)
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
        if (res.data.current_map) {
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
    if (isBattling.value) {
      stopBattle()
      startBattle()
    }
  }

  function startBattle() {
    if (isBattling.value || !character.value || !currentMap.value) return
    isBattling.value = true
    isPaused.value = false
    sessionDrops.value = {}
    addLog(0, `在【${currentMap.value.name}】开始历练…`, 'system')
    scheduleFight()
    startAutoSave()
  }

  function stopBattle() {
    isBattling.value = false
    isPaused.value = false
    if (battleTimer.value) { clearTimeout(battleTimer.value); battleTimer.value = null }
    if (logTimer.value) { clearInterval(logTimer.value); logTimer.value = null }
    if (deathTimer.value) { clearInterval(deathTimer.value); deathTimer.value = null }
    logQueue.value = []
    pendingResult.value = null
    inFight.value = false
    currentMonsterInfo.value = null
    deathCooldown.value = 0
    stopAutoSave()
    flushSave()
  }

  function togglePause() {
    isPaused.value = !isPaused.value
    if (!isPaused.value && isBattling.value) {
      scheduleFight()
    }
  }

  function scheduleFight() {
    if (!isBattling.value || isPaused.value || deathCooldown.value > 0) return
    if (logQueue.value.length > 0) return
    executeFight()
  }

  async function executeFight() {
    if (!character.value || !currentMap.value) return
    inFight.value = true

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
        body: { map_id: currentMapId.value, auto_sell: autoSell, auto_sell_tier: autoSellTier },
      })

      if (res.code !== 200) {
        addLog(0, res.message || '战斗请求失败', 'system')
        inFight.value = false
        scheduleFight()
        return
      }

      const data = res.data

      if (data.character) {
        character.value = data.character
      }

      waveMonsterNames.value = data.monsterNames || []
      currentMonsterInfo.value = data.monsterInfo || null
      displayPlayerHp.value = character.value!.max_hp
      displayPlayerMaxHp.value = character.value!.max_hp

      pendingResult.value = {
        won: data.won,
        expGained: data.expGained || 0,
        spiritStoneGained: data.stoneGained || 0,
        drops: [],
      }

      logQueue.value = data.logs || []
      drainLogQueue()
    } catch {
      addLog(0, '战斗请求失败', 'system')
      inFight.value = false
      battleTimer.value = window.setTimeout(() => scheduleFight(), 2000)
    }
  }

  function emitLog(log: BattleLogEntry) {
    addLog(log.turn, log.text, log.type)
    if (log.playerHp !== undefined) displayPlayerHp.value = Math.max(0, log.playerHp)
    if (log.playerMaxHp !== undefined) displayPlayerMaxHp.value = log.playerMaxHp
    if (log.monsterHp !== undefined) displayMonsterHp.value = Math.max(0, log.monsterHp)
    if (log.monsterMaxHp !== undefined) displayMonsterMaxHp.value = log.monsterMaxHp
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
        if (isPaused.value) return
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
      scheduleFight()
    } else {
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

  function forceBreakthrough() {
    checkBreakthrough()
  }

  function checkBreakthrough() {
    if (!character.value) return
    if (!character.value.realm_tier) character.value.realm_tier = 1
    if (!character.value.realm_stage) character.value.realm_stage = 1

    const req = expRequired.value
    if (character.value.cultivation_exp >= req) {
      character.value.cultivation_exp -= req
      const t = REALM_TIERS.find(r => r.tier === character.value!.realm_tier)
      if (!t) return

      if (character.value.realm_stage >= t.stages) {
        if (character.value.realm_tier < 8) {
          character.value.realm_tier++
          character.value.realm_stage = 1
        }
      } else {
        character.value.realm_stage++
      }

      addLog(0, `突破成功！你已晋升为【${realmName.value}】`, 'system')

      fetchApi('/game/update-character', {
        method: 'POST',
        body: {
          realm_tier: character.value.realm_tier,
          realm_stage: character.value.realm_stage,
          cultivation_exp: character.value.cultivation_exp,
        },
      }).catch((err: any) => console.error('保存境界失败', err))
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

  function startAutoSave() {
    stopAutoSave()
    saveTimer.value = window.setInterval(() => {
      if (character.value) {
        fetchApi('/game/update-character', {
          method: 'POST',
          body: { current_map: currentMapId.value },
        }).catch(() => {})
      }
    }, 30000)
  }

  function stopAutoSave() {
    if (saveTimer.value) { clearInterval(saveTimer.value); saveTimer.value = null }
  }

  function flushSave() {
    if (character.value) {
      fetchApi('/game/update-character', {
        method: 'POST',
        body: { current_map: currentMapId.value },
      }).catch(() => {})
    }
  }

  return {
    character, loaded, battleLogs, isBattling, currentMapId, isPaused,
    killCount, sessionExp, sessionStone, sessionDrops, equippedSkills, caveBonus, battleFrenzyStacks, deathCooldown, activeTab,
    displayPlayerHp, displayPlayerMaxHp, displayMonsterHp, displayMonsterMaxHp,
    currentMonsterInfo, waveMonsterNames, inFight,
    currentMap, unlockedMaps, realmName, expRequired, expPercent,
    charLevel, levelExpRequired, levelExpPercent, levelBonus,
    loadGameData, changeMap, startBattle, stopBattle, togglePause, clearLogs, addLog, flushSave, forceBreakthrough,
  }
})
