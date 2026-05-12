// 真双人战斗引擎（玩家 + 助战子女 vs 怪物群）
// Phase 1：身法排序 / 玩家普攻 + 神通 / 子女普攻 + 血脉功法 / 怪物 50:50 选目标
// Phase 2a：DOT (burn/poison/bleed) + 控制 (freeze/stun/root/silence) + brittle/atk_down
// 复用 battleEngine.ts 的 calculateDamage 公式，保证伤害结果一致
// 后续：套装、附灵、反伤池、复活、玩家 buff (shield/regen/immune)

import {
  calculateDamage,
  calcDotDamage,
  getElementMultiplier,
  DEBUFF_NAMES,
  buildSetEffects,
  buildActiveSetTiers,
  type SetEffectsState,
  type ActiveDebuff,
  type BattlerStats,
  type BattleLogEntry,
  type MonsterTemplate,
  type EquippedSkillInfo,
  type SkillRefInfo,
  type WaveBattleStats,
  initMonsterSkillState,
  monsterChooseSkill,
  tickMonsterCds,
  type MonsterSkillState,
} from './battleEngine';
import type { DebuffType } from './skillData';
import type { ChildSkill } from './childSkillData';
import { BATTLE_FORMULA, PLAYER_CAPS } from '../../shared/balance';

// ---- 类型 ----
export interface DuoAssistInput {
  stats: BattlerStats;                  // 子女实际战斗属性（含装备+天赋）
  innateSkill?: ChildSkill | null;      // 觉醒的血脉功法（divine 类型才进入 CD 池）
}

export interface DuoWaveBattleResult {
  won: boolean;
  logs: BattleLogEntry[];
  totalExp: number;
  totalStone: number;
  monstersKilled: { template: MonsterTemplate }[];
  // 与 WaveBattleResult 对齐的成就统计字段（phase 1 暂全部默认值，phase 2 补真实统计）
  stats: WaveBattleStats;
  // 真双人专用：战斗结束时玩家 / 子女血量（前端最终血条）
  finalPlayerHp: number;
  finalAssistHp: number;
  assistFainted: boolean;
}

// 扩展 BattleLogEntry 字段（不改 battleEngine 中的接口，运行时附加）
type ActorTag = 'player' | 'assist' | 'monster';
interface DuoLogExtra {
  actor?: ActorTag;
  assistHp?: number;
  assistMaxHp?: number;
}
type DuoLog = BattleLogEntry & DuoLogExtra;

// ---- 内部类型 ----
interface BattlerRuntime {
  stats: any;
  alive: boolean;
}
interface MonsterRuntime {
  stats: any;
  template: MonsterTemplate;
  alive: boolean;
  skillState: MonsterSkillState;
  baseAtk: number;
  baseDef: number;
  debuffs: ActiveDebuff[];
  frozenTurns: number;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// ---- 主入口 ----
export function runDuoWaveBattle(
  playerStats: BattlerStats,
  assistInput: DuoAssistInput | null,
  monsterList: { stats: BattlerStats; template: MonsterTemplate }[],
  equippedSkills?: EquippedSkillInfo,
  maxTurnsOverride?: number,
): DuoWaveBattleResult {
  // 没有助战 → 退回传统单人逻辑（调用方应改走 runWaveBattle，这里兜底）
  if (!assistInput) {
    // 兜底：构造一个空 assist，避免 NPE。但更好的做法是 fight.post.ts 在没有助战时走 runWaveBattle
    assistInput = {
      stats: { ...playerStats, name: '__noop__', maxHp: 0, hp: 0, atk: 0, def: 0, spd: 0 } as BattlerStats,
      innateSkill: null,
    };
  }

  // 1. 初始化玩家（应用功法被动 → 与 runWaveBattle 一致）
  const player: any = { ...playerStats, hp: playerStats.maxHp, buffs: [], debuffs: [], frozenTurns: 0 };
  if (equippedSkills?.passiveEffects) {
    const p = equippedSkills.passiveEffects;
    const ps: any = playerStats as any;
    if (ps._flatAtk !== undefined) {
      player.atk   = Math.floor(ps._flatAtk * (1 + (ps._pctSumAtk || 0) + p.atkPercent / 100));
      player.def   = Math.floor(ps._flatDef * (1 + (ps._pctSumDef || 0) + p.defPercent / 100));
      player.maxHp = Math.floor(ps._flatHp  * (1 + (ps._pctSumHp  || 0) + p.hpPercent / 100));
      player.spd   = Math.floor(ps._flatSpd * (1 + (ps._pctSumSpd || 0) + (p.spdPercent || 0) / 100));
    } else {
      player.atk = Math.floor(player.atk * (1 + p.atkPercent / 100));
      player.def = Math.floor(player.def * (1 + p.defPercent / 100));
      player.maxHp = Math.floor(player.maxHp * (1 + p.hpPercent / 100));
      player.spd = Math.floor(player.spd * (1 + (p.spdPercent || 0) / 100));
    }
    player.hp = player.maxHp;
    player.crit_rate += p.critRate;
    player.crit_dmg += p.critDmg;
    player.dodge += p.dodge || 0;
    player.lifesteal += p.lifesteal || 0;
    if (!player.resists) player.resists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0 };
    player.resists.metal += p.resistMetal || 0;
    player.resists.wood  += p.resistWood  || 0;
    player.resists.water += p.resistWater || 0;
    player.resists.fire  += p.resistFire  || 0;
    player.resists.earth += p.resistEarth || 0;
    player.resists.ctrl  += p.resistCtrl  || 0;
    // v3 紫色被动：DOT 增伤 / 闪避必暴 / 治疗增幅
    (player as any).dotAmpPct = p.dotAmpPct || 0;
    (player as any).critAfterDodge = !!p.critAfterDodge;
    (player as any).healAmpPct = p.healAmpPct || 0;
  }
  // v3.6 副属性 DOT_DMG_PCT / REFLECT_PCT 注入到 player
  const equipDotPct = (playerStats as any).equipDotDmgPct || 0;
  const equipReflectPct = (playerStats as any).equipReflectPct || 0;
  if (equipDotPct > 0) (player as any).dotAmpPct = ((player as any).dotAmpPct || 0) + equipDotPct * 100;
  if (equipReflectPct > 0) (player as any).reflectPctBonus = ((player as any).reflectPctBonus || 0) + equipReflectPct;

  // 1.4 附灵运行时状态注入（13 hooks）
  const aw = (playerStats as any).awaken || {};
  player.awakenState = {
    burnOnHitChance: aw.burnOnHitChance || 0,
    poisonOnHitChance: aw.poisonOnHitChance || 0,
    bleedOnHitChance: aw.bleedOnHitChance || 0,
    chainAttackChance: aw.chainAttackChance || 0,
    armorPenPct: aw.armorPenPct || 0,
    executeBonus: aw.executeBonus || 0,
    lowHpAtkBonus: aw.lowHpAtkBonus || 0,
    lowHpDefBonus: aw.lowHpDefBonus || 0,
    damageReduction: aw.damageReduction || 0,
    critTakenReduction: aw.critTakenReduction || 0,
    regenPerTurn: aw.regenPerTurn || 0,
    cleanseInterval: aw.cleanseInterval || 0,
    vsBossBonus: aw.vsBossBonus || 0,
    vsEliteBonus: aw.vsEliteBonus || 0,
    debuffDurationBonus: aw.debuffDurationBonus || 0,
    // v1.3 灵戒附灵·主修功法增幅
    mainSkillMultBonus: aw.mainSkillMultBonus || 0,
    mainSkillCritRate: aw.mainSkillCritRate || 0,
    mainSkillArmorPen: aw.mainSkillArmorPen || 0,
    mainSkillLifesteal: aw.mainSkillLifesteal || 0,
    mainSkillBleedAmp: aw.mainSkillBleedAmp || 0,
    mainSkillBleedAmpElem: aw.mainSkillBleedAmpElem,
    mainSkillPoisonAmp: aw.mainSkillPoisonAmp || 0,
    mainSkillPoisonAmpElem: aw.mainSkillPoisonAmpElem,
    mainSkillFreezeChance: aw.mainSkillFreezeChance || 0,
    mainSkillFreezeChanceElem: aw.mainSkillFreezeChanceElem,
    mainSkillExtraFreezeChance: aw.mainSkillExtraFreezeChance || 0,
    mainSkillBurnDuration: aw.mainSkillBurnDuration || 0,
    mainSkillBurnDurationElem: aw.mainSkillBurnDurationElem,
    mainSkillBurnAmp: aw.mainSkillBurnAmp || 0,
    mainSkillBurnAmpElem: aw.mainSkillBurnAmpElem,
    mainSkillBrittleAmp: aw.mainSkillBrittleAmp || 0,
    mainSkillBrittleAmpElem: aw.mainSkillBrittleAmpElem,
    mainSkillExecuteThr: aw.mainSkillExecuteThr || 0,
    mainSkillExecuteBonus: aw.mainSkillExecuteBonus || 0,
  };
  player.awakenTurnCounter = 0;
  // 与功法被动同位钩子 Max-Merge（poisonOnHitTaken / burnOnHitTaken / reflectOnCrit）
  if (equippedSkills?.passiveEffects) {
    const pe: any = equippedSkills.passiveEffects;
    if (aw.poisonOnHitTaken) pe.poisonOnHitTaken = Math.max(pe.poisonOnHitTaken || 0, aw.poisonOnHitTaken);
    if (aw.burnOnHitTaken)   pe.burnOnHitTaken   = Math.max(pe.burnOnHitTaken   || 0, aw.burnOnHitTaken);
    if (aw.reflectOnCrit)    pe.reflectOnCrit    = Math.max(pe.reflectOnCrit    || 0, aw.reflectOnCrit);
  }

  // 1.5 套装系统：buildSetEffects + 静态加成（sword/blade/fan）— 仅玩家享受
  const playerWeaponType = (playerStats as any).weaponType || null;
  const setEffects: SetEffectsState = buildSetEffects((playerStats as any).equipSetCounts, playerWeaponType);
  player.setEffects = setEffects;
  player.spearStacks = 0;
  player.guaranteedCritNext = false;
  player.armorPen = (player.armorPen || 0) + setEffects.spearArmorPen;
  player.lifesteal = Math.min(0.25, (player.lifesteal || 0) + setEffects.spearLifesteal);
  if (setEffects.swordActive) {
    player.atk = Math.floor(player.atk * (1 + setEffects.swordAtkPct));
    player.def = Math.floor(player.def * (1 + setEffects.swordDefPct));
    player.crit_rate = Math.min(PLAYER_CAPS.critRate, (player.crit_rate || 0) + setEffects.swordCritRateFlat);
  }
  if (setEffects.bladeActive) {
    player.crit_rate = Math.min(PLAYER_CAPS.critRate, (player.crit_rate || 0) + setEffects.bladeBaseCritRate);
    player.crit_dmg = Math.min(PLAYER_CAPS.critDmg, (player.crit_dmg || 0) + setEffects.bladeBaseCritDmg);
  }
  if (setEffects.fanActive && setEffects.fanSpiritPct > 0) {
    player.spirit = Math.floor((player.spirit || 0) * (1 + setEffects.fanSpiritPct));
  }
  player._bladeAddedRate = 0;
  player._bladeAddedDmg = 0;
  player._bladeStackCount = 0;

  // 2. 初始化助战子女（独立 hp / cd）
  const assistStats = assistInput.stats;
  const assist: any = {
    ...assistStats,
    hp: assistStats.maxHp,
    buffs: [],
    debuffs: [],
    frozenTurns: 0,
    _isNoop: assistStats.name === '__noop__',
  };
  // 血脉功法 CD 跟踪（出场时可立即施放第一次）
  const assistSkillCd = { current: 0, skill: assistInput.innateSkill || null };
  const isAssistDivine = !!(assistSkillCd.skill && assistSkillCd.skill.type === 'divine' && (assistSkillCd.skill.cdTurns || 0) > 0);

  // 3. 初始化怪物
  const monsters: MonsterRuntime[] = monsterList.map(m => {
    const stats: any = { ...m.stats };
    stats._role = m.template.role;
    return {
      stats,
      template: m.template,
      alive: true,
      skillState: initMonsterSkillState(m.template),
      baseAtk: m.stats.atk,
      baseDef: m.stats.def,
      debuffs: [],
      frozenTurns: 0,
    };
  });

  // 4. 玩家神通 CD 池（divineSkills 来自 equippedSkills.divineSkills；首回合可立刻施放一次）
  const playerDivineCds: number[] = (equippedSkills?.divineSkills || []).map(() => 0);

  // 5. 日志与统计
  const logs: DuoLog[] = [];
  let totalExp = 0;
  let totalStone = 0;
  const monstersKilled: { template: MonsterTemplate }[] = [];
  const maxTurns = maxTurnsOverride ?? 50 * monsterList.length;
  const battleStats: WaveBattleStats = {
    playerCritCount: 0,
    playerHitsTaken: 0,
    elementAdvantageHit: false,
    lifestealFullRecovery: false,
    bossKilledByTurn3: false,
  };

  // 开战时打印已激活套装
  const activeSets = buildActiveSetTiers((playerStats as any).equipSetCounts);
  for (const s of activeSets) {
    logs.push({ turn: 0, text: `❖ 套装激活：${s.name} (${s.count}/7 · ${s.tier} 件套)`, type: 'set', actor: 'player', playerHp: player.hp, playerMaxHp: player.maxHp, monstersHp: monsters.map(m => Math.max(0, m.stats.hp)) });
    logs.push({ turn: 0, text: `  ${s.desc}`, type: 'set', actor: 'player', playerHp: player.hp, playerMaxHp: player.maxHp, monstersHp: monsters.map(m => Math.max(0, m.stats.hp)) });
  }

  // ---- helpers ----
  const snap = (): DuoLogExtra & Pick<BattleLogEntry, 'playerHp' | 'playerMaxHp' | 'monstersHp'> => ({
    playerHp: Math.max(0, player.hp),
    playerMaxHp: player.maxHp,
    monstersHp: monsters.map(m => Math.max(0, m.stats.hp)),
    assistHp: assist._isNoop ? undefined : Math.max(0, assist.hp),
    assistMaxHp: assist._isNoop ? undefined : assist.maxHp,
  });

  const firstAlive = (): MonsterRuntime | null => monsters.find(m => m.alive && m.stats.hp > 0) || null;

  // ===== Phase 2a: DOT + 控制 helpers =====
  // 目标类型：玩家 / 助战 / 怪物 — 共有字段 debuffs/frozenTurns
  type DebuffTarget = { debuffs: ActiveDebuff[]; frozenTurns: number; stats?: any; maxHp?: number; resists?: any };

  // 施加 debuff
  // inflictor === 'player' 时享受 dotAmpPct / elementDmg / 五行抗性 / 套装效果 / 附灵主修元素 amp
  const tryApplyDebuff = (
    target: DebuffTarget,
    targetName: string,
    debuff: { type: DebuffType; chance: number; duration: number; value?: number },
    attackerAtk: number,
    turn: number,
    inflictor: 'player' | 'assist' | 'monster',
    isPlayerMainSkill: boolean = false,
  ): boolean => {
    let effChance = debuff.chance;
    let effDuration = debuff.duration;
    let effValue = debuff.value;
    let burnAmpMul = 1.0, bleedAmpMul = 1.0, poisonAmpMul = 1.0;
    let tag = '';
    // ✦ v1.3 灵戒附灵·主修元素匹配增强
    if (inflictor === 'player' && isPlayerMainSkill) {
      const aState = player.awakenState;
      const mainElem = player._mainSkillElement;
      if (aState && mainElem) {
        if (debuff.type === 'burn' && mainElem === 'fire' && aState.mainSkillBurnDurationElem === 'fire' && aState.mainSkillBurnDuration) {
          effDuration += aState.mainSkillBurnDuration;
          tag += ` ✦焚天+${aState.mainSkillBurnDuration}`;
        }
        if (debuff.type === 'burn' && mainElem === 'fire' && aState.mainSkillBurnAmpElem === 'fire' && aState.mainSkillBurnAmp) {
          burnAmpMul = 1 + aState.mainSkillBurnAmp;
          tag += ` ✦焚烬+${(aState.mainSkillBurnAmp * 100).toFixed(0)}%`;
        }
        if ((debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') && mainElem === 'water' && aState.mainSkillFreezeChanceElem === 'water' && aState.mainSkillFreezeChance) {
          effChance = Math.min(1, effChance + aState.mainSkillFreezeChance);
          tag += ` ✦水蕴+${(aState.mainSkillFreezeChance * 100).toFixed(0)}%`;
        }
        if (debuff.type === 'brittle' && mainElem === 'earth' && aState.mainSkillBrittleAmpElem === 'earth' && aState.mainSkillBrittleAmp) {
          effValue = (effValue || 0.15) * (1 + aState.mainSkillBrittleAmp);
          tag += ` ✦厚土+${(aState.mainSkillBrittleAmp * 100).toFixed(0)}%`;
        }
        if (debuff.type === 'bleed' && mainElem === 'metal' && aState.mainSkillBleedAmpElem === 'metal' && aState.mainSkillBleedAmp) {
          bleedAmpMul = 1 + aState.mainSkillBleedAmp;
          tag += ` ✦金鸣+${(aState.mainSkillBleedAmp * 100).toFixed(0)}%`;
        }
        if (debuff.type === 'poison' && mainElem === 'wood' && aState.mainSkillPoisonAmpElem === 'wood' && aState.mainSkillPoisonAmp) {
          poisonAmpMul = 1 + aState.mainSkillPoisonAmp;
          tag += ` ✦木灵+${(aState.mainSkillPoisonAmp * 100).toFixed(0)}%`;
        }
      }
    }
    // ❖ 极寒套：玩家施加 freeze 时 chance +X
    if (inflictor === 'player' && debuff.type === 'freeze' && setEffects.freezeChanceBonus > 0) {
      effChance = Math.min(1, effChance + setEffects.freezeChanceBonus);
      tag += ` ❖极寒+${(setEffects.freezeChanceBonus * 100).toFixed(0)}%`;
    }
    // ❖ 回归基本功 7 件套：玩家主修攻击触发 debuff 概率 × basicBackDebuffMul
    if (inflictor === 'player' && isPlayerMainSkill && setEffects.basicBackDebuffMul > 1) {
      effChance = Math.min(1, effChance * setEffects.basicBackDebuffMul);
      tag += ` ❖本源×${setEffects.basicBackDebuffMul.toFixed(1)}`;
    }
    if (Math.random() >= effChance) return false;
    const isCtrl = debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root' || debuff.type === 'silence';
    if (isCtrl) {
      const r = Math.min(0.7, target.resists?.ctrl || target.stats?.resists?.ctrl || 0);
      if (r > 0 && Math.random() < r) {
        logs.push({ turn, text: `  ${targetName}抵抗了${DEBUFF_NAMES[debuff.type]}`, type: 'normal', ...snap() });
        return false;
      }
    }
    // ✦ 天师附灵：施加方延长减益持续回合（不影响控制类）
    const dBonus = (inflictor === 'player' && !isCtrl) ? (player.awakenState?.debuffDurationBonus || 0) : 0;
    let duration = effDuration + dBonus;
    if (dBonus > 0) tag += ` ✦天师+${dBonus}`;
    if (debuff.type === 'freeze' || debuff.type === 'stun' || debuff.type === 'root') {
      target.frozenTurns = Math.max(target.frozenTurns, duration);
      logs.push({ turn, text: `  ${targetName}被${DEBUFF_NAMES[debuff.type]} ${duration} 回合${tag}`, type: 'normal', ...snap() });
      return true;
    }
    // DOT / brittle / atk_down / silence
    const targetMaxHp = target.stats?.maxHp || target.maxHp || 0;
    let dmg = calcDotDamage(debuff.type, targetMaxHp, attackerAtk);
    const isDotType = debuff.type === 'poison' || debuff.type === 'burn' || debuff.type === 'bleed';
    if (isDotType && inflictor === 'player') {
      if ((player as any).dotAmpPct) dmg = Math.max(1, Math.floor(dmg * (1 + (player as any).dotAmpPct / 100)));
      const dotElem: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
      const el = dotElem[debuff.type];
      if (el) {
        const ed = (player.elementDmg as any)?.[el] || 0;
        if (ed > 0) dmg = Math.max(1, Math.floor(dmg * (1 + ed / 100)));
        const targetElem = target.stats?.element || null;
        const elemMul = getElementMultiplier(el, targetElem);
        if (elemMul !== 1.0) dmg = Math.max(1, Math.floor(dmg * elemMul));
        const resistRaw = target.stats?.resists?.[el] ?? target.resists?.[el] ?? 0;
        const resist = Math.min(BATTLE_FORMULA.maxResistRate, resistRaw);
        if (resist > 0) dmg = Math.max(1, Math.floor(dmg * (1 - resist)));
      }
      // ✦ 主修元素 amp（火/木/金对应 burn/poison/bleed 每跳放大）
      if (debuff.type === 'burn'   && burnAmpMul   > 1) dmg = Math.max(1, Math.floor(dmg * burnAmpMul));
      if (debuff.type === 'poison' && poisonAmpMul > 1) dmg = Math.max(1, Math.floor(dmg * poisonAmpMul));
      if (debuff.type === 'bleed'  && bleedAmpMul  > 1) dmg = Math.max(1, Math.floor(dmg * bleedAmpMul));
      // ❖ 火神/万毒/血魔套：玩家施加 DOT 时每跳伤害 × dmgMul（v3.8.5）
      let dmgMul = 1;
      if (debuff.type === 'burn'   && setEffects.burnDmgMul   > 1) dmgMul = setEffects.burnDmgMul;
      if (debuff.type === 'poison' && setEffects.poisonDmgMul > 1) dmgMul = setEffects.poisonDmgMul;
      if (debuff.type === 'bleed'  && setEffects.bleedDmgMul  > 1) dmgMul = setEffects.bleedDmgMul;
      if (dmgMul > 1) dmg = Math.max(1, Math.floor(dmg * dmgMul));
    }
    const exists = target.debuffs.find(d => d.type === debuff.type);
    // ❖ 火神 7 件套：已灼烧再施加时延长 +N 回合（cap burnDurationCap）
    if (exists && inflictor === 'player' && debuff.type === 'burn' && setEffects.burnExtendIfStacked > 0) {
      const newRemain = Math.min(setEffects.burnDurationCap, exists.remaining + setEffects.burnExtendIfStacked);
      duration = newRemain;
      tag += ` ❖焚天延+${setEffects.burnExtendIfStacked}`;
    }
    if (exists) {
      exists.remaining = duration;
      exists.value = effValue;
      exists.damagePerTurn = dmg;
    } else {
      target.debuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: effValue });
    }
    let text = `${targetName}陷入${DEBUFF_NAMES[debuff.type]} ${duration} 回合`;
    if (debuff.type === 'poison') text += ` (每回合 ${dmg} 毒伤)`;
    else if (debuff.type === 'burn') text += ` (每回合 ${dmg} 火伤)`;
    else if (debuff.type === 'bleed') text += ` (每回合 ${dmg} 流血)`;
    else if (debuff.type === 'brittle') text += ` (受伤+${(((effValue || 0.15)) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'atk_down') text += ` (攻击-${(((effValue || 0.15)) * 100).toFixed(0)}%)`;
    else if (debuff.type === 'silence') text += ` (无法使用神通)`;
    logs.push({ turn, text: `  ${text}${tag}`, type: 'normal', ...snap() });

    // ❖ 火神/万毒/血魔套：玩家施加 burn/poison/bleed 时立即多结算 (instantMul - 1) 跳额外伤害
    // 每场每目标每种 debuff 每回合限触发 1 次（避免多段技能滚雪球）
    if (inflictor === 'player' && isDotType && target.stats) {
      let instantMul = 1;
      let setName = '';
      if (debuff.type === 'burn'   && setEffects.burnInstantMul   > 1) { instantMul = setEffects.burnInstantMul;   setName = '火神套'; }
      if (debuff.type === 'poison' && setEffects.poisonInstantMul > 1) { instantMul = setEffects.poisonInstantMul; setName = '万毒套'; }
      if (debuff.type === 'bleed'  && setEffects.bleedInstantMul  > 1) { instantMul = setEffects.bleedInstantMul;  setName = '血魔套'; }
      if (instantMul > 1) {
        const t = target as any;
        if (!t._setInstantTriggered) t._setInstantTriggered = {};
        const key = `${debuff.type}_${turn}`;
        if (!t._setInstantTriggered[key]) {
          t._setInstantTriggered[key] = true;
          const extra = instantMul - 1;
          const totalDmg = dmg * extra;
          target.stats.hp = Math.max(0, target.stats.hp - totalDmg);
          logs.push({ turn, text: `  ❖【${setName}】${DEBUFF_NAMES[debuff.type]}立即额外结算 ${extra} 跳，对${targetName}造成 ${totalDmg} 伤害`, type: 'set', ...snap() });
        }
      }
    }
    return true;
  };

  // 结算 DOT 并递减 — 返回此回合总 DOT 伤害；不扣血（调用方扣）
  const tickDebuffs = (target: DebuffTarget, targetName: string, turn: number): number => {
    let dot = 0;
    for (const d of target.debuffs) {
      if (d.damagePerTurn > 0) {
        dot += d.damagePerTurn;
        logs.push({ turn, text: `  ${targetName}受到${DEBUFF_NAMES[d.type]} ${d.damagePerTurn} 点伤害`, type: 'normal', ...snap() });
      }
    }
    for (let i = target.debuffs.length - 1; i >= 0; i--) {
      target.debuffs[i].remaining--;
      if (target.debuffs[i].remaining <= 0) {
        logs.push({ turn, text: `  ${targetName}的${DEBUFF_NAMES[target.debuffs[i].type]}效果结束`, type: 'normal', ...snap() });
        target.debuffs.splice(i, 1);
      }
    }
    return dot;
  };

  const hasSilence = (t: DebuffTarget): boolean => t.debuffs.some(d => d.type === 'silence');
  const getBrittleBonus = (t: DebuffTarget): number => {
    const b = t.debuffs.find(d => d.type === 'brittle');
    return b ? (b.value || 0.15) : 0;
  };
  const getAtkDownMul = (t: DebuffTarget): number => {
    const a = t.debuffs.find(d => d.type === 'atk_down');
    return a ? (1 - (a.value || 0.15)) : 1;
  };

  // ===== Phase 2c-1: 附灵 hooks (13 钩子) =====
  // v1.2 附灵：命中后 roll 主动 DOT（焚魂/淬毒/裂魂）— 仅玩家攻击命中目标时调用
  const triggerAwakenOnHit = (target: any, targetName: string, turn: number) => {
    const st = player.awakenState;
    if (!st) return;
    if (st.burnOnHitChance > 0 && Math.random() < st.burnOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'burn' as DebuffType, chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【焚魂】${targetName}被烈焰灼烧`, type: 'buff', actor: 'player', ...snap() });
    }
    if (st.poisonOnHitChance > 0 && Math.random() < st.poisonOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'poison' as DebuffType, chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【淬毒】${targetName}中毒`, type: 'buff', actor: 'player', ...snap() });
    }
    if (st.bleedOnHitChance > 0 && Math.random() < st.bleedOnHitChance) {
      const ok = tryApplyDebuff(target, targetName, { type: 'bleed' as DebuffType, chance: 1.0, duration: 2 }, player.atk, turn, 'player');
      if (ok) logs.push({ turn, text: `  ✦【裂魂】${targetName}流血不止`, type: 'buff', actor: 'player', ...snap() });
    }
  };

  // v1.2 附灵：每回合开始 — 回春 + 洗髓
  const runAwakenTurnStart = (turn: number) => {
    const st = player.awakenState;
    if (!st) return;
    player.awakenTurnCounter = (player.awakenTurnCounter || 0) + 1;
    if (st.regenPerTurn > 0 && player.hp > 0 && player.hp < player.maxHp) {
      const heal = Math.max(1, Math.floor(player.maxHp * st.regenPerTurn));
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      if (player.hp > before) {
        logs.push({ turn, text: `  ✦【回春】回复 ${player.hp - before} 点气血`, type: 'buff', actor: 'player', ...snap() });
      }
    }
    if (st.cleanseInterval > 0 && (player.awakenTurnCounter % st.cleanseInterval === 0)) {
      if (player.frozenTurns > 0) {
        player.frozenTurns = 0;
        logs.push({ turn, text: `  ✦【洗髓】解除了控制状态`, type: 'buff', actor: 'player', ...snap() });
      } else if (player.debuffs && player.debuffs.length > 0) {
        const silenceIdx = player.debuffs.findIndex((d: ActiveDebuff) => d.type === 'silence');
        let removed: ActiveDebuff;
        if (silenceIdx >= 0) {
          removed = player.debuffs.splice(silenceIdx, 1)[0];
        } else {
          removed = player.debuffs.shift();
        }
        logs.push({ turn, text: `  ✦【洗髓】清除了 ${DEBUFF_NAMES[removed.type] || removed.type}`, type: 'buff', actor: 'player', ...snap() });
      }
    }
  };

  // v1.2 附灵：玩家受伤减免（返回修正后的伤害）
  const applyAwakenIncomingReduction = (damage: number, isCrit: boolean): number => {
    const st = player.awakenState;
    if (!st) return damage;
    let d = damage;
    if (st.damageReduction > 0) d = d * (1 - st.damageReduction);
    if (isCrit && st.critTakenReduction > 0) d = d * (1 - st.critTakenReduction);
    if (st.lowHpDefBonus > 0 && player.maxHp > 0 && player.hp / player.maxHp < 0.30) {
      d = d * (1 / (1 + st.lowHpDefBonus));
    }
    return Math.max(1, Math.floor(d));
  };

  const killCheck = (target: MonsterRuntime, turn: number, killerName: string) => {
    if (target.alive && target.stats.hp <= 0) {
      target.alive = false;
      const exp = Math.floor(target.template.exp * randFloat(0.9, 1.1));
      const stone = rand(target.template.stone_min, target.template.stone_max);
      totalExp += exp;
      totalStone += stone;
      monstersKilled.push({ template: target.template });
      logs.push({
        turn,
        text: `${target.stats.name}被${killerName}击杀，获得 ${exp} 修为、${stone} 灵石`,
        type: 'kill',
        ...snap(),
      });
    }
  };

  // 玩家一次行动（普攻 / 优先释放可用神通）
  const playerAction = (turn: number) => {
    const tgt = firstAlive();
    if (!tgt) return;
    if (player.hp <= 0) return;

    // silence / 回归基本功套 → 屏蔽神通
    const silenced = hasSilence(player);
    if (silenced) logs.push({ turn, text: `  你被封印,无法使用神通`, type: 'normal', ...snap() });
    const banDivine = silenced || setEffects.basicBackBanDivine;

    // 选神通：第一个 CD ≤ 0 的 divineSkill
    let chosenSkill: SkillRefInfo | null = null;
    let chosenIdx = -1;
    if (!banDivine && equippedSkills?.divineSkills?.length) {
      for (let i = 0; i < equippedSkills.divineSkills.length; i++) {
        if (playerDivineCds[i] <= 0) {
          chosenSkill = equippedSkills.divineSkills[i];
          chosenIdx = i;
          break;
        }
      }
    }
    const isMainSkill = !chosenSkill; // 用基础 activeSkill 即视为主修
    const activeSkillRef = equippedSkills?.activeSkill;
    // 设置当前主修元素到 player 上，供 tryApplyDebuff 检查主修元素 amp
    player._mainSkillElement = isMainSkill ? (activeSkillRef?.element ?? null) : null;

    const activeName = chosenSkill?.name || activeSkillRef?.name || '普通攻击';
    let mul = chosenSkill?.multiplier ?? activeSkillRef?.multiplier ?? 1.0;
    const elem = chosenSkill?.element ?? (isMainSkill ? (activeSkillRef?.element ?? null) : null);
    const hits = chosenSkill?.hitCount || activeSkillRef?.hitCount || 1;
    const ignoreDef = chosenSkill?.ignoreDef || 0;
    // v1.3 灵戒附灵·心法贯通：主修伤害倍率 +X%
    if (isMainSkill && player.awakenState?.mainSkillMultBonus) {
      mul *= 1 + player.awakenState.mainSkillMultBonus;
    }

    // atk_down 折扣（临时改 player.atk，攻击后还原）
    const atkDownMul = getAtkDownMul(player);
    const origAtk = player.atk;
    if (atkDownMul < 1) player.atk = Math.max(1, Math.floor(player.atk * atkDownMul));

    if (hits > 1) {
      logs.push({ turn, text: `[第${turn}回合] 你施展了【${activeName}】(${hits}段)!`, type: 'crit', actor: 'player', ...snap() });
    }
    let totalDealt = 0;
    let anyHit = false;
    let anyCrit = false;
    for (let h = 0; h < hits; h++) {
      if (!tgt.alive) break;
      const perMul = hits > 1 ? mul / hits : mul;
      // ❖ 极寒套：目标冻结时不可闪避
      const ignoreDodge = !!(setEffects.frozenCannotDodge && tgt.frozenTurns > 0);
      const r = calculateDamage(player, tgt.stats, perMul, elem, ignoreDef, ignoreDodge);
      if (r.damage === 0) {
        logs.push({ turn, text: `[第${turn}回合] 你${chosenSkill ? `的【${activeName}】` : '的攻击'}被${tgt.stats.name}闪避了`, type: 'normal', actor: 'player', ...snap() });
        continue;
      }
      let dealt = r.damage;
      // 目标 brittle → 受伤增加
      const brittle = getBrittleBonus(tgt);
      if (brittle > 0) dealt = Math.floor(dealt * (1 + brittle));
      // ❖ 极寒套：对冻结目标伤害 ×(1+dmgVsFrozen)
      if (setEffects.dmgVsFrozen > 0 && tgt.frozenTurns > 0) {
        dealt = Math.floor(dealt * (1 + setEffects.dmgVsFrozen));
      }
      // ❖ 万毒套蚀骨：目标中毒时玩家造成伤害 ×(1+poisonDmgAmpVsTarget)
      if (setEffects.poisonDmgAmpVsTarget > 0) {
        const tgtPoisoned = tgt.debuffs.some(d => d.type === 'poison' && d.remaining > 0);
        if (tgtPoisoned) dealt = Math.floor(dealt * (1 + setEffects.poisonDmgAmpVsTarget));
      }
      // ❖ 十三枪：命中后累加 spearStacks，下一击按 stack × perStack 加伤
      if (setEffects.spearActive && player.spearStacks > 0) {
        dealt = Math.floor(dealt * (1 + player.spearStacks * setEffects.spearStackDmgPerLevel));
      }
      tgt.stats.hp -= dealt;
      totalDealt += dealt;
      anyHit = true;
      if (r.isCrit) anyCrit = true;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'player', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] 你${chosenSkill ? `施展【${activeName}】` : ''}攻击了${tgt.stats.name}，${critText}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'player', ...snap() });
      }
      // ❖ 十三枪：命中累层（每段 1 命中 → 1 层），满层标记下一击必会心
      if (setEffects.spearActive && setEffects.spearStackPerHit > 0) {
        const before = player.spearStacks;
        if (before < setEffects.spearMaxStacks) {
          const next = Math.min(setEffects.spearMaxStacks, before + setEffects.spearStackPerHit);
          player.spearStacks = next;
          if (next === setEffects.spearMaxStacks && setEffects.spearGuaranteedCritOnMax && !player.guaranteedCritNext) {
            player.guaranteedCritNext = true;
            logs.push({ turn, text: `  ❖【十三枪】满 ${setEffects.spearMaxStacks} 层！下一击必会心`, type: 'set', actor: 'player', ...snap() });
          }
        } else if (setEffects.spearGuaranteedCritOnMax && r.isCrit) {
          // 满层 + 这一击是必会心，消费完重置叠层
          player.spearStacks = 0;
        }
      }
      // ❖ 刀狂：非会心 → 叠 critRate/critDmg；会心 → 重置 _bladeStackCount
      if (setEffects.bladeActive) {
        if (!r.isCrit) {
          player._bladeStackCount++;
          const oldRate = player._bladeAddedRate || 0;
          const oldDmg  = player._bladeAddedDmg  || 0;
          const newRate = Math.min(PLAYER_CAPS.critRate, player.crit_rate + setEffects.bladeStackCritRate);
          const newDmg  = Math.min(PLAYER_CAPS.critDmg,  player.crit_dmg  + setEffects.bladeStackCritDmg);
          player.crit_rate = newRate;
          player.crit_dmg  = newDmg;
          player._bladeAddedRate = oldRate + (newRate - (newRate - setEffects.bladeStackCritRate));
          player._bladeAddedDmg  = oldDmg  + (newDmg  - (newDmg  - setEffects.bladeStackCritDmg));
        } else if (player._bladeStackCount > 0) {
          // 重置叠加
          player.crit_rate = Math.max(0, player.crit_rate - (player._bladeAddedRate || 0));
          player.crit_dmg  = Math.max(1, player.crit_dmg  - (player._bladeAddedDmg  || 0));
          player._bladeAddedRate = 0;
          player._bladeAddedDmg  = 0;
          player._bladeStackCount = 0;
        }
      }
    }
    // 还原 atk
    player.atk = origAtk;

    // 吸血（❖ 血魔套：目标流血时吸血加成 / ✦ 主修吸血：mainSkillLifesteal 按 maxHp%）
    if (totalDealt > 0 && player.hp > 0) {
      let lsRate = player.lifesteal || 0;
      const tgtBleeding = tgt.debuffs.some(d => d.type === 'bleed' && d.remaining > 0);
      if (tgtBleeding && setEffects.bleedLifestealIfBleeding > 0) {
        lsRate = Math.min(0.25, lsRate + setEffects.bleedLifestealIfBleeding);
      }
      if (lsRate > 0) {
        const heal = Math.floor(totalDealt * lsRate);
        if (heal > 0 && player.hp < player.maxHp) {
          const actual = Math.min(heal, player.maxHp - player.hp);
          player.hp += actual;
          logs.push({ turn, text: `  【吸血】回复 ${actual} 点气血`, type: 'buff', actor: 'player', ...snap() });
        }
      }
      // ✦ v1.3 主修吸血：仅主修攻击触发，按 maxHp × 系数回血
      const mainLsRate = (isMainSkill && player.awakenState?.mainSkillLifesteal) || 0;
      if (mainLsRate > 0 && player.hp < player.maxHp) {
        const mainHeal = Math.floor(player.maxHp * mainLsRate);
        if (mainHeal > 0) {
          const actual = Math.min(mainHeal, player.maxHp - player.hp);
          player.hp += actual;
          logs.push({ turn, text: `  ✦【主修噬灵】回复 ${actual} 点气血`, type: 'buff', actor: 'player', ...snap() });
        }
      }
    }

    // ✦ v1.2 附灵：命中后概率追加 burn/poison/bleed（焚魂/淬毒/裂魂）
    if (anyHit && tgt.alive) {
      triggerAwakenOnHit(tgt, tgt.stats.name, turn);
    }

    // ✦ v3.9 主修玄冰诀：命中后独立 X 概率追加 1 回合冻结（不依赖原 debuff roll）
    if (anyHit && isMainSkill && player.awakenState?.mainSkillExtraFreezeChance && tgt.alive) {
      if (Math.random() < player.awakenState.mainSkillExtraFreezeChance) {
        tryApplyDebuff(tgt, tgt.stats.name, { type: 'freeze' as DebuffType, chance: 1.0, duration: 1 }, player.atk, turn, 'player', isMainSkill);
      }
    }

    // 神通 / 主修攻击 debuff 施加（命中过 ≥1 次才尝试，与 battleEngine 一致）
    const usedSkillDebuff = chosenSkill?.debuff || (isMainSkill ? activeSkillRef?.debuff : undefined);
    if (anyHit && usedSkillDebuff && tgt.alive) {
      tryApplyDebuff(tgt, tgt.stats.name, usedSkillDebuff, player.atk, turn, 'player', isMainSkill);
    }

    // ❖ 剑仙套：神通后额外触发 swordQiHits 次剑气（swordQiMul 倍）
    if (chosenSkill && setEffects.swordActive && setEffects.swordQiHits > 0 && tgt.alive) {
      for (let i = 0; i < setEffects.swordQiHits; i++) {
        if (!tgt.alive) break;
        const ignoreDodgeQi = !!(setEffects.frozenCannotDodge && tgt.frozenTurns > 0);
        const dr = calculateDamage(player, tgt.stats, setEffects.swordQiMul, chosenSkill.element, ignoreDef, ignoreDodgeQi);
        if (dr.damage === 0) {
          logs.push({ turn, text: `  ❖【剑仙·剑气 ${i + 1}/${setEffects.swordQiHits}】被${tgt.stats.name}闪避`, type: 'set', actor: 'player', ...snap() });
          continue;
        }
        let qiDmg = dr.damage;
        const brittle = getBrittleBonus(tgt);
        if (brittle > 0) qiDmg = Math.floor(qiDmg * (1 + brittle));
        tgt.stats.hp -= qiDmg;
        logs.push({ turn, text: `  ❖【剑仙·剑气 ${i + 1}/${setEffects.swordQiHits}】${dr.isCrit ? '会心!' : ''}对${tgt.stats.name}造成 ${qiDmg} 伤害`, type: 'set', actor: 'player', ...snap() });
      }
    }

    // ❖ 天机套：神通后额外释放 fanExtraCasts 次同 mul × fanExtraMul
    if (chosenSkill && setEffects.fanActive && setEffects.fanExtraCasts > 0 && setEffects.fanExtraMul > 0 && tgt.alive) {
      const fanMul = mul * setEffects.fanExtraMul;
      for (let i = 0; i < setEffects.fanExtraCasts; i++) {
        if (!tgt.alive) break;
        const ignoreDodgeFan = !!(setEffects.frozenCannotDodge && tgt.frozenTurns > 0);
        const fr = calculateDamage(player, tgt.stats, fanMul, elem, ignoreDef, ignoreDodgeFan);
        if (fr.damage === 0) {
          logs.push({ turn, text: `  ❖【天机·额外段 ${i + 1}/${setEffects.fanExtraCasts}】被${tgt.stats.name}闪避`, type: 'set', actor: 'player', ...snap() });
          continue;
        }
        let fanDmg = fr.damage;
        const brittle = getBrittleBonus(tgt);
        if (brittle > 0) fanDmg = Math.floor(fanDmg * (1 + brittle));
        tgt.stats.hp -= fanDmg;
        logs.push({ turn, text: `  ❖【天机·额外段 ${i + 1}/${setEffects.fanExtraCasts}】${fr.isCrit ? '会心!' : ''}【${activeName}】对${tgt.stats.name}造成 ${fanDmg} 伤害`, type: 'set', actor: 'player', ...snap() });
      }
    }

    // 击杀检查
    killCheck(tgt, turn, '你');

    // 神通进 CD
    if (chosenSkill && chosenIdx >= 0) {
      playerDivineCds[chosenIdx] = chosenSkill.cdTurns || 0;
    }
  };

  // 子女一次行动（血脉功法可用就放，否则普攻）
  const assistAction = (turn: number) => {
    if (assist._isNoop) return;
    if (assist.hp <= 0) return;
    const tgt = firstAlive();
    if (!tgt) return;

    // 子女被 silence 也屏蔽血脉功法
    const silenced = hasSilence(assist);
    if (silenced) logs.push({ turn, text: `  ${assist.name}·助战被封印,无法使用血脉功法`, type: 'normal', actor: 'assist', ...snap() });

    let useSkill: ChildSkill | null = null;
    if (!silenced && isAssistDivine && assistSkillCd.current <= 0) {
      useSkill = assistSkillCd.skill!;
    }
    const skillName = useSkill?.name || '普通攻击';
    const mul = useSkill?.multiplier ?? 1.0;
    const elem = useSkill?.element ?? null;
    const ignoreDef = useSkill?.ignoreDef || 0;
    const hits = useSkill?.hitCount || 1;

    // atk_down 折扣
    const atkDownMul = getAtkDownMul(assist);
    const origAtk = assist.atk;
    if (atkDownMul < 1) assist.atk = Math.max(1, Math.floor(assist.atk * atkDownMul));

    if (hits > 1) {
      logs.push({ turn, text: `[第${turn}回合] ${assist.name}·助战施展【${skillName}】(${hits}段)!`, type: 'crit', actor: 'assist', ...snap() });
    }
    let totalDealt = 0;
    for (let h = 0; h < hits; h++) {
      if (!tgt.alive) break;
      const perMul = hits > 1 ? mul / hits : mul;
      const r = calculateDamage(assist, tgt.stats, perMul, elem, ignoreDef);
      if (r.damage === 0) {
        logs.push({ turn, text: `[第${turn}回合] ${assist.name}·助战的攻击被${tgt.stats.name}闪避了`, type: 'normal', actor: 'assist', ...snap() });
        continue;
      }
      let dealt = r.damage;
      const brittle = getBrittleBonus(tgt);
      if (brittle > 0) dealt = Math.floor(dealt * (1 + brittle));
      tgt.stats.hp -= dealt;
      totalDealt += dealt;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'assist', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] ${assist.name}·助战${useSkill ? `施展【${skillName}】` : ''}攻击了${tgt.stats.name}，${critText}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'assist', ...snap() });
      }
    }
    assist.atk = origAtk;

    // 子女吸血
    if (totalDealt > 0 && assist.lifesteal > 0 && assist.hp > 0) {
      const heal = Math.floor(totalDealt * assist.lifesteal);
      if (heal > 0 && assist.hp < assist.maxHp) {
        const actual = Math.min(heal, assist.maxHp - assist.hp);
        assist.hp += actual;
        logs.push({ turn, text: `  ${assist.name}·助战【吸血】回复 ${actual} 点气血`, type: 'buff', actor: 'assist', ...snap() });
      }
    }

    // 助战血脉功法 debuff 施加（按 'player' 待遇 — 队友享受 dotAmpPct 等同身受？暂定按 'assist' 不享受玩家专属加成）
    // 注：assist 当前继承 player 的 dotAmpPct 也不合适，Phase 2a 走最保守：用 'assist' 路径（无加成）
    if (useSkill && (useSkill as any).debuff && tgt.alive) {
      const d = (useSkill as any).debuff;
      tryApplyDebuff(tgt, tgt.stats.name, d, assist.atk, turn, 'assist');
    }

    killCheck(tgt, turn, `${assist.name}·助战`);

    if (useSkill && isAssistDivine) {
      assistSkillCd.current = useSkill.cdTurns || 0;
    }
  };

  // 怪物一次行动（50/50 选玩家或助战；若一方倒下只打另一方）
  const monsterAction = (m: MonsterRuntime, turn: number) => {
    if (!m.alive || m.stats.hp <= 0) return;
    if (player.hp <= 0 && (assist.hp <= 0 || assist._isNoop)) return;

    // 选目标
    const candidates: Array<{ ref: any; isPlayer: boolean }> = [];
    if (player.hp > 0) candidates.push({ ref: player, isPlayer: true });
    if (!assist._isNoop && assist.hp > 0) candidates.push({ ref: assist, isPlayer: false });
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];

    const mSkill = monsterChooseSkill(
      m.skillState, m.stats.hp, m.stats.maxHp, m.template.role === 'boss',
      { activeBuffTypes: [], teamMinHpRatio: undefined, isHealer: false },
    );

    // healer 自愈 / buff 类暂不在双人引擎中支持复杂逻辑（Phase 2）
    if (mSkill && mSkill.multiplier === 0) {
      logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${mSkill.name}】`, type: 'normal', actor: 'monster', ...snap() });
      return;
    }

    const skillMul = mSkill ? mSkill.multiplier : 1.0;
    const skillElem = mSkill ? mSkill.element : null;
    const skillName = mSkill ? mSkill.name : '普通攻击';
    const hits = mSkill?.hitCount || 1;
    const tgtName = pick.isPlayer ? '你' : `${assist.name}·助战`;

    // 怪物 atk_down 折扣
    const atkDownMul = getAtkDownMul(m);
    const origAtk = m.stats.atk;
    if (atkDownMul < 1) m.stats.atk = Math.max(1, Math.floor(m.stats.atk * atkDownMul));

    if (hits > 1) {
      logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${skillName}】(${hits}段) → ${tgtName}!`, type: 'crit', actor: 'monster', ...snap() });
    }
    let anyHit = false;
    for (let h = 0; h < hits; h++) {
      const perMul = hits > 1 ? skillMul / hits : skillMul;
      const r = calculateDamage(m.stats, pick.ref, perMul, skillElem);
      if (r.damage === 0) {
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}的攻击被${tgtName}闪避了`, type: 'normal', actor: 'monster', ...snap() });
        continue;
      }
      // 目标 brittle → 受伤加深
      let dealt = r.damage;
      const brittle = getBrittleBonus(pick.ref);
      if (brittle > 0) dealt = Math.floor(dealt * (1 + brittle));
      // ✦ v1.2 附灵：仅玩家受伤享受 damageReduction / critTakenReduction / lowHpDefBonus
      if (pick.isPlayer) dealt = applyAwakenIncomingReduction(dealt, r.isCrit);
      pick.ref.hp -= dealt;
      anyHit = true;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}对${tgtName}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'monster', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}${mSkill ? '施展【' + skillName + '】' : ''}攻击了${tgtName}，${critText}造成 ${dealt} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'monster', ...snap() });
      }
      // ✦ v1.2 附灵：玩家被命中时反向触发 DOT/反伤池（poisonOnHitTaken / burnOnHitTaken / reflectOnCrit）
      // pe.* 字段在 player 初始化时已与 awaken Max-Merge 合并
      if (pick.isPlayer) {
        const pe = equippedSkills?.passiveEffects as any;
        if (pe?.poisonOnHitTaken && Math.random() < pe.poisonOnHitTaken) {
          tryApplyDebuff(m, m.stats.name, { type: 'poison' as DebuffType, chance: 1, duration: 2 }, player.atk, turn, 'player');
        }
        if (pe?.burnOnHitTaken && Math.random() < pe.burnOnHitTaken) {
          tryApplyDebuff(m, m.stats.name, { type: 'burn' as DebuffType, chance: 1, duration: 2 }, player.atk, turn, 'player');
        }
        if (r.isCrit && pe?.reflectOnCrit && Math.random() < pe.reflectOnCrit) {
          const reflectDmg = Math.floor(dealt * pe.reflectOnCrit);
          if (reflectDmg > 0) {
            m.stats.hp = Math.max(0, m.stats.hp - reflectDmg);
            logs.push({ turn, text: `  ✦【反伤】对${m.stats.name}反弹 ${reflectDmg} 点伤害`, type: 'buff', actor: 'player', ...snap() });
          }
        }
      }
      if (pick.ref.hp <= 0) {
        pick.ref.hp = 0;
        if (!pick.isPlayer) {
          logs.push({ turn, text: `${assist.name}·助战倒下了`, type: 'death', actor: 'assist', ...snap() });
        }
        break;
      }
    }
    m.stats.atk = origAtk;

    // 怪物技能 debuff → 玩家或助战（inflictor='monster' 不享受加成）
    if (anyHit && mSkill?.debuff && pick.ref.hp > 0) {
      tryApplyDebuff(pick.ref, tgtName, mSkill.debuff, m.stats.atk, turn, 'monster');
    }
  };

  // ==== 主回合循环 ====
  for (let turn = 1; turn <= maxTurns; turn++) {
    const aliveMonsters = monsters.filter(m => m.alive);
    if (aliveMonsters.length === 0) break;
    if (player.hp <= 0) {
      logs.push({ turn, text: '你陨落了…3回合后原地复活', type: 'death', actor: 'player', playerHp: 0, playerMaxHp: player.maxHp, monstersHp: monsters.map(m => Math.max(0, m.stats.hp)), assistHp: assist._isNoop ? undefined : Math.max(0, assist.hp), assistMaxHp: assist._isNoop ? undefined : assist.maxHp });
      return {
        won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats,
        finalPlayerHp: 0, finalAssistHp: Math.max(0, assist.hp), assistFainted: assist.hp <= 0,
      };
    }

    // ✦ v1.2 附灵：回合开始 — 回春（regenPerTurn）+ 洗髓（cleanseInterval）
    runAwakenTurnStart(turn);

    // ==== 回合开始：DOT 结算 ====
    // 玩家 DOT
    const pDot = tickDebuffs(player, '你', turn);
    if (pDot > 0) {
      player.hp -= pDot;
      if (player.hp <= 0) {
        logs.push({ turn, text: '你在持续伤害中陨落了…3回合后原地复活', type: 'death', actor: 'player', ...snap() });
        return {
          won: false, logs, totalExp, totalStone, monstersKilled, stats: battleStats,
          finalPlayerHp: 0, finalAssistHp: Math.max(0, assist.hp), assistFainted: !assist._isNoop && assist.hp <= 0,
        };
      }
    }
    // 助战 DOT
    if (!assist._isNoop && assist.hp > 0) {
      const aDot = tickDebuffs(assist, `${assist.name}·助战`, turn);
      if (aDot > 0) {
        assist.hp -= aDot;
        if (assist.hp <= 0) {
          assist.hp = 0;
          logs.push({ turn, text: `${assist.name}·助战在持续伤害中倒下了`, type: 'death', actor: 'assist', ...snap() });
        }
      }
    }
    // 怪物 DOT
    for (const m of aliveMonsters) {
      const dot = tickDebuffs(m, m.stats.name, turn);
      if (dot > 0) m.stats.hp -= dot;
    }
    // 击杀检查（DOT 致死）
    for (const m of monsters) {
      if (m.alive && m.stats.hp <= 0) {
        m.alive = false;
        const exp = Math.floor(m.template.exp * randFloat(0.9, 1.1));
        const stone = rand(m.template.stone_min, m.template.stone_max);
        totalExp += exp;
        totalStone += stone;
        monstersKilled.push({ template: m.template });
        logs.push({ turn, text: `${m.stats.name}因持续伤害死亡，获得 ${exp} 修为、${stone} 灵石`, type: 'kill', ...snap() });
      }
    }
    // DOT 已全部清场？
    if (monsters.every(m => !m.alive)) break;

    // 行动顺序：按身法降序排（玩家、助战、所有存活怪物）
    interface Actor { kind: 'player' | 'assist' | 'monster'; spd: number; idx: number; }
    const actors: Actor[] = [];
    actors.push({ kind: 'player', spd: player.spd || 0, idx: -1 });
    if (!assist._isNoop && assist.hp > 0) actors.push({ kind: 'assist', spd: assist.spd || 0, idx: -1 });
    monsters.forEach((m, i) => { if (m.alive) actors.push({ kind: 'monster', spd: m.stats.spd || 0, idx: i }); });
    // 同身法随机
    actors.sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd;
      return Math.random() - 0.5;
    });

    for (const ac of actors) {
      // 提前退出（一方阵营全灭）
      if (player.hp <= 0 && (assist._isNoop || assist.hp <= 0)) break;
      if (monsters.every(m => !m.alive)) break;

      if (ac.kind === 'player') {
        if (player.hp > 0) {
          if (player.frozenTurns > 0) {
            player.frozenTurns--;
            logs.push({ turn, text: `  你被控制中,无法行动`, type: 'normal', actor: 'player', ...snap() });
          } else {
            playerAction(turn);
          }
        }
      } else if (ac.kind === 'assist') {
        if (!assist._isNoop && assist.hp > 0) {
          if (assist.frozenTurns > 0) {
            assist.frozenTurns--;
            logs.push({ turn, text: `  ${assist.name}·助战被控制中,无法行动`, type: 'normal', actor: 'assist', ...snap() });
          } else {
            assistAction(turn);
          }
        }
      } else {
        const m = monsters[ac.idx];
        if (m && m.alive && m.stats.hp > 0) {
          if (m.frozenTurns > 0) {
            m.frozenTurns--;
            logs.push({ turn, text: `  ${m.stats.name}被控制中,无法行动`, type: 'normal', actor: 'monster', ...snap() });
          } else {
            monsterAction(m, turn);
          }
        }
      }
    }

    // 回合末：递减 CD
    if (isAssistDivine && assistSkillCd.current > 0) assistSkillCd.current--;
    for (let i = 0; i < playerDivineCds.length; i++) {
      if (playerDivineCds[i] > 0) playerDivineCds[i]--;
    }
    for (const m of monsters) {
      if (m.alive) tickMonsterCds(m.skillState);
    }
  }

  const aliveAtEnd = monsters.filter(m => m.alive);
  const won = aliveAtEnd.length === 0 && player.hp > 0;
  return {
    won,
    logs,
    totalExp,
    totalStone,
    monstersKilled,
    stats: battleStats,
    finalPlayerHp: Math.max(0, player.hp),
    finalAssistHp: assist._isNoop ? 0 : Math.max(0, assist.hp),
    assistFainted: !assist._isNoop && assist.hp <= 0,
  };
}
