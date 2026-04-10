import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CharacterData, BattleLogEntry, MapData, MonsterBattleInfo } from '../game/types';
import { MAPS, REALM_TIERS, getRealmName, getExpRequired, formatNumber, getUnlockedMaps } from '../game/data';
import type { EquippedSkillInfo } from '../game/battleEngine';
import { getGameData, updateCharacter } from '../api/game';
import request from '../api/request';
// 战斗计算已迁移到后端，前端仅负责展示

export const useGameStore = defineStore('game', () => {
  // ===== 角色数据 =====
  const character = ref<CharacterData | null>(null);
  const loaded = ref(false);

  // ===== 战斗状态 =====
  const battleLogs = ref<BattleLogEntry[]>([]);
  const isBattling = ref(false);
  const currentMapId = ref('qingfeng_valley');
  const battleTimer = ref<number | null>(null);
  const isPaused = ref(false);
  const killCount = ref(0);
  const sessionExp = ref(0);
  const sessionStone = ref(0);

  // 战斗中血条状态
  const displayPlayerHp = ref(0);
  const displayPlayerMaxHp = ref(0);
  const displayMonsterHp = ref(0);
  const displayMonsterMaxHp = ref(0);
  const currentMonsterInfo = ref<MonsterBattleInfo | null>(null);
  const waveMonsterNames = ref<string[]>([]); // 本波所有怪物名字
  const inFight = ref(false);

  // 死亡冷却
  const deathCooldown = ref(0);
  const deathTimer = ref<number | null>(null);

  // 日志队列（逐条输出用）
  const logQueue = ref<BattleLogEntry[]>([]);
  const logTimer = ref<number | null>(null);
  const pendingResult = ref<{ won: boolean; expGained: number; spiritStoneGained: number; drops: any[] } | null>(null);

  // 自动保存(保留兼容)
  const saveTimer = ref<number | null>(null);

  // 本次历练掉落统计
  const sessionDrops = ref<Record<string, number>>({});

  // 已装备功法
  const equippedSkills = ref<EquippedSkillInfo | null>(null);

  // 战意沸腾叠层数
  const battleFrenzyStacks = ref(0);

  // 洞府加成
  const caveBonus = ref({
    expBonus: 0,      // 演武堂百分比加成
    skillRate: 0,     // 藏经阁百分比加成
    craftRate: 0,     // 炼丹房百分比加成
    equipQuality: 0,  // 炼器房等级偏移
  });

  // ===== 底部tab =====
  const activeTab = ref<'battle' | 'character' | 'skills' | 'equip' | 'cultivate' | 'cave'>('battle');

  // ===== 计算属性 =====
  const currentMap = computed<MapData | undefined>(() =>
    MAPS.find(m => m.id === currentMapId.value)
  );

  const unlockedMaps = computed(() => {
    if (!character.value) return MAPS.slice(0, 1);
    return getUnlockedMaps(character.value.realm_tier || 1, character.value.realm_stage || 1);
  });

  const realmName = computed(() => {
    if (!character.value) return '';
    return getRealmName(character.value.realm_tier || 1, character.value.realm_stage || 1);
  });

  const expRequired = computed(() => {
    if (!character.value) return 0;
    return getExpRequired(character.value.realm_tier || 1, character.value.realm_stage || 1);
  });

  const expPercent = computed(() => {
    if (!character.value || expRequired.value === 0) return 0;
    return Math.min(100, (character.value.cultivation_exp / expRequired.value) * 100);
  });

  // 等级系统 (上限 200, 属性按段递增)
  const charLevel = computed(() => Math.min(200, character.value?.level || 1));

  // 升级所需经验: 按等级段递增
  const levelExpRequired = computed(() => {
    const lv = charLevel.value;
    if (lv >= 200) return Infinity;
    if (lv <= 30)  return Math.floor(80 * Math.pow(lv, 1.3));
    if (lv <= 80)  return Math.floor(120 * Math.pow(lv, 1.4));
    if (lv <= 150) return Math.floor(200 * Math.pow(lv, 1.45));
    return Math.floor(350 * Math.pow(lv, 1.5));
  });

  const levelExpPercent = computed(() => {
    if (!character.value || levelExpRequired.value === 0 || levelExpRequired.value === Infinity) return charLevel.value >= 200 ? 100 : 0;
    return Math.min(100, (character.value.level_exp / levelExpRequired.value) * 100);
  });

  // 等级属性加成: 按等级段递增
  const levelBonus = computed(() => {
    const lv = charLevel.value;
    let hp = 0, atk = 0, def = 0, spd = 0;
    for (let i = 1; i < lv; i++) {
      if (i <= 50)       { hp += 5;  atk += 2;  def += 1; spd += 1; }
      else if (i <= 100) { hp += 10; atk += 4;  def += 2; spd += 2; }
      else if (i <= 150) { hp += 20; atk += 8;  def += 4; spd += 3; }
      else               { hp += 40; atk += 15; def += 8; spd += 5; }
    }
    return { hp, atk, def, spd };
  });

  // ===== 方法 =====

  // 加载游戏数据
  async function loadGameData() {
    try {
      const res: any = await getGameData();
      if (res.code === 200 && res.data) {
        character.value = res.data;
        if (res.data.current_map) {
          currentMapId.value = res.data.current_map;
        }
        loaded.value = true;
      }
      return res;
    } catch (e) {
      console.error('加载游戏数据失败', e);
    }
  }

  // 切换地图
  function changeMap(mapId: string) {
    if (currentMapId.value === mapId) return;
    currentMapId.value = mapId;
    battleFrenzyStacks.value = 0; // 换地图重置战意
    addLog(0, `你前往了【${currentMap.value?.name}】`, 'system');
    // 如果正在战斗，重新开始
    if (isBattling.value) {
      stopBattle();
      startBattle();
    }
  }

  // 开始自动战斗
  function startBattle() {
    if (isBattling.value || !character.value || !currentMap.value) return;
    isBattling.value = true;
    isPaused.value = false;
    sessionDrops.value = {};
    addLog(0, `在【${currentMap.value.name}】开始历练…`, 'system');
    scheduleFight();
    startAutoSave();
  }

  // 停止战斗
  function stopBattle() {
    isBattling.value = false;
    isPaused.value = false;
    if (battleTimer.value) {
      clearTimeout(battleTimer.value);
      battleTimer.value = null;
    }
    if (logTimer.value) {
      clearInterval(logTimer.value);
      logTimer.value = null;
    }
    if (deathTimer.value) {
      clearInterval(deathTimer.value);
      deathTimer.value = null;
    }
    logQueue.value = [];
    pendingResult.value = null;
    inFight.value = false;
    currentMonsterInfo.value = null;
    deathCooldown.value = 0;
    stopAutoSave();
    flushSave();
  }

  // 暂停/继续
  function togglePause() {
    isPaused.value = !isPaused.value;
    if (!isPaused.value && isBattling.value) {
      scheduleFight();
    }
  }

  // 安排下一场战斗
  function scheduleFight() {
    if (!isBattling.value || isPaused.value || deathCooldown.value > 0) return;
    // 等当前日志队列输出完再开始下一场
    if (logQueue.value.length > 0) return;
    executeFight();
  }

  // 执行一波战斗 (后端计算)
  async function executeFight() {
    if (!character.value || !currentMap.value) return;
    inFight.value = true;

    try {
      const res: any = await request.post('/battle/fight', { map_id: currentMapId.value });

      if (res.code !== 200) {
        addLog(0, res.message || '战斗请求失败', 'system');
        inFight.value = false;
        scheduleFight();
        return;
      }

      const data = res.data;

      // 更新角色数据(后端已直接存库)
      if (data.character) {
        character.value = data.character;
      }

      waveMonsterNames.value = data.monsterNames || [];
      displayPlayerHp.value = character.value!.max_hp;
      displayPlayerMaxHp.value = character.value!.max_hp;

      pendingResult.value = {
        won: data.won,
        expGained: data.expGained || 0,
        spiritStoneGained: data.stoneGained || 0,
        drops: [],
      };

      logQueue.value = data.logs || [];
      drainLogQueue();
    } catch (err) {
      addLog(0, '战斗请求失败', 'system');
      inFight.value = false;
      // 延迟重试
      battleTimer.value = window.setTimeout(() => scheduleFight(), 2000);
    }
  }

  // 输出一条日志并同步血条
  function emitLog(log: BattleLogEntry) {
    addLog(log.turn, log.text, log.type);
    // 同步血条
    if (log.playerHp !== undefined) displayPlayerHp.value = Math.max(0, log.playerHp);
    if (log.playerMaxHp !== undefined) displayPlayerMaxHp.value = log.playerMaxHp;
    if (log.monsterHp !== undefined) displayMonsterHp.value = Math.max(0, log.monsterHp);
    if (log.monsterMaxHp !== undefined) displayMonsterMaxHp.value = log.monsterMaxHp;
  }

  // 每秒输出一条日志
  function drainLogQueue() {
    if (logTimer.value) {
      clearInterval(logTimer.value);
      logTimer.value = null;
    }

    // 立刻输出第一条
    if (logQueue.value.length > 0) {
      emitLog(logQueue.value.shift()!);
    }

    // 后续每秒一条
    if (logQueue.value.length > 0) {
      logTimer.value = window.setInterval(() => {
        if (logQueue.value.length === 0 || !isBattling.value) {
          if (logTimer.value) clearInterval(logTimer.value);
          logTimer.value = null;
          onBattleLogsFinished();
          return;
        }

        if (isPaused.value) return;

        emitLog(logQueue.value.shift()!);

        if (logQueue.value.length === 0) {
          if (logTimer.value) clearInterval(logTimer.value);
          logTimer.value = null;
          onBattleLogsFinished();
        }
      }, 1000);
    } else {
      onBattleLogsFinished();
    }
  }

  // 日志输出完毕后结算战斗结果(后端已存库,前端只更新显示)
  function onBattleLogsFinished() {
    if (!character.value || !pendingResult.value) return;

    const result = pendingResult.value;
    pendingResult.value = null;
    inFight.value = false;

    if (result.won) {
      killCount.value++;
      if (battleFrenzyStacks.value < 10) battleFrenzyStacks.value++;

      sessionExp.value += result.expGained;
      sessionStone.value += result.spiritStoneGained;

      // 掉落统计(仅显示用)
      if (result.drops && Array.isArray(result.drops)) {
        result.drops.forEach((dropName: string) => {
          if (dropName) sessionDrops.value[dropName] = (sessionDrops.value[dropName] || 0) + 1;
        });
      }

      scheduleFight();
    } else {
      // 死亡：3秒冷却(后端已扣灵石)
      deathCooldown.value = 3;
      battleFrenzyStacks.value = 0;

      deathTimer.value = window.setInterval(() => {
        deathCooldown.value--;
        if (deathCooldown.value <= 0) {
          if (deathTimer.value) clearInterval(deathTimer.value);
          deathTimer.value = null;
          addLog(0, '你原地复活了，继续历练', 'system');
          scheduleFight();
        }
      }, 1000);
    }
  }

  // 手动触发境界突破
  function forceBreakthrough() {
    checkBreakthrough();
  }

  function checkBreakthrough() {
    if (!character.value) return;
    // 兜底: realm_tier/realm_stage 为 null 时默认练气1层
    if (!character.value.realm_tier) character.value.realm_tier = 1;
    if (!character.value.realm_stage) character.value.realm_stage = 1;

    const req = expRequired.value;
    if (character.value.cultivation_exp >= req) {
      character.value.cultivation_exp -= req;
      const t = REALM_TIERS.find(r => r.tier === character.value!.realm_tier);
      if (!t) return;

      if (character.value.realm_stage >= t.stages) {
        // 进入下一大境界
        if (character.value.realm_tier < 8) {
          character.value.realm_tier++;
          character.value.realm_stage = 1;
        }
      } else {
        character.value.realm_stage++;
      }

      // 属性成长
      const growthFactor = 1 + (character.value.realm_tier - 1) * 0.8 + character.value.realm_stage * 0.1;
      character.value.max_hp = Math.floor(500 * growthFactor);
      character.value.atk = Math.floor(50 * growthFactor);
      character.value.def = Math.floor(30 * growthFactor);
      character.value.spd = Math.floor(50 * growthFactor);

      addLog(0, `突破成功！你已晋升为【${realmName.value}】`, 'system');

      // 保存到后端
      updateCharacter({
        realm_tier: character.value.realm_tier,
        realm_stage: character.value.realm_stage,
        max_hp: character.value.max_hp,
        atk: character.value.atk,
        def: character.value.def,
        spd: character.value.spd,
      }).catch(err => console.error('保存境界失败', err));
    }
  }

  // 添加日志
  function addLog(turn: number, text: string, type: BattleLogEntry['type']) {
    battleLogs.value.push({ turn, text, type });
    // 保留最新200条
    if (battleLogs.value.length > 200) {
      battleLogs.value.splice(0, battleLogs.value.length - 200);
    }
  }

  // 清空日志
  function clearLogs() {
    battleLogs.value = [];
  }

  // ===== 自动保存(后端战斗已直接存库,保留地图切换保存) =====
  function startAutoSave() {
    stopAutoSave();
    saveTimer.value = window.setInterval(() => {
      // 定期保存当前地图
      if (character.value) {
        updateCharacter({ current_map: currentMapId.value }).catch(() => {});
      }
    }, 30000);
  }

  function stopAutoSave() {
    if (saveTimer.value) {
      clearInterval(saveTimer.value);
      saveTimer.value = null;
    }
  }

  function flushSave() {
    if (character.value) {
      updateCharacter({ current_map: currentMapId.value }).catch(() => {});
    }
  }

  return {
    // state
    character, loaded, battleLogs, isBattling, currentMapId, isPaused,
    killCount, sessionExp, sessionStone, sessionDrops, equippedSkills, caveBonus, battleFrenzyStacks, deathCooldown, activeTab,
    displayPlayerHp, displayPlayerMaxHp, displayMonsterHp, displayMonsterMaxHp,
    currentMonsterInfo, waveMonsterNames, inFight,
    // computed
    currentMap, unlockedMaps, realmName, expRequired, expPercent,
    charLevel, levelExpRequired, levelExpPercent, levelBonus,
    // methods
    loadGameData, changeMap, startBattle, stopBattle, togglePause, clearLogs, addLog, flushSave, forceBreakthrough,
  };
});
