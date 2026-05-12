// 真双人战斗引擎（玩家 + 助战子女 vs 怪物群）
// Phase 1 骨架：身法排序 / 玩家普攻 + 神通 / 子女普攻 + 血脉功法 / 怪物 50:50 选目标 / 死亡判定
// 复用 battleEngine.ts 的 calculateDamage 公式，保证伤害结果一致
// 后续会话补：套装、附灵、控制 (stun/freeze/silence/root/brittle)、DOT、反伤池

import {
  calculateDamage,
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
import type { ChildSkill } from './childSkillData';

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
  }

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

  // ---- helpers ----
  const snap = (): DuoLogExtra & Pick<BattleLogEntry, 'playerHp' | 'playerMaxHp' | 'monstersHp'> => ({
    playerHp: Math.max(0, player.hp),
    playerMaxHp: player.maxHp,
    monstersHp: monsters.map(m => Math.max(0, m.stats.hp)),
    assistHp: assist._isNoop ? undefined : Math.max(0, assist.hp),
    assistMaxHp: assist._isNoop ? undefined : assist.maxHp,
  });

  const firstAlive = (): MonsterRuntime | null => monsters.find(m => m.alive && m.stats.hp > 0) || null;

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

    // 选神通：第一个 CD ≤ 0 的 divineSkill
    let chosenSkill: SkillRefInfo | null = null;
    let chosenIdx = -1;
    if (equippedSkills?.divineSkills?.length) {
      for (let i = 0; i < equippedSkills.divineSkills.length; i++) {
        if (playerDivineCds[i] <= 0) {
          chosenSkill = equippedSkills.divineSkills[i];
          chosenIdx = i;
          break;
        }
      }
    }

    const activeName = chosenSkill?.name || '普通攻击';
    const mul = chosenSkill?.multiplier ?? 1.0;
    const elem = chosenSkill?.element ?? null;
    const hits = chosenSkill?.hitCount || 1;

    if (hits > 1) {
      logs.push({ turn, text: `[第${turn}回合] 你施展了【${activeName}】(${hits}段)!`, type: 'crit', actor: 'player', ...snap() });
    }
    let totalDealt = 0;
    let anyCrit = false;
    for (let h = 0; h < hits; h++) {
      if (!tgt.alive) break;
      const perMul = hits > 1 ? mul / hits : mul;
      const r = calculateDamage(player, tgt.stats, perMul, elem, chosenSkill?.ignoreDef || 0);
      if (r.damage === 0) {
        logs.push({ turn, text: `[第${turn}回合] 你${chosenSkill ? `的【${activeName}】` : '的攻击'}被${tgt.stats.name}闪避了`, type: 'normal', actor: 'player', ...snap() });
        continue;
      }
      tgt.stats.hp -= r.damage;
      totalDealt += r.damage;
      if (r.isCrit) anyCrit = true;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'player', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] 你${chosenSkill ? `施展【${activeName}】` : ''}攻击了${tgt.stats.name}，${critText}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'player', ...snap() });
      }
    }

    // 吸血
    if (totalDealt > 0 && player.lifesteal > 0 && player.hp > 0) {
      const heal = Math.floor(totalDealt * player.lifesteal);
      if (heal > 0 && player.hp < player.maxHp) {
        const actual = Math.min(heal, player.maxHp - player.hp);
        player.hp += actual;
        logs.push({ turn, text: `  【吸血】回复 ${actual} 点气血`, type: 'buff', actor: 'player', ...snap() });
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

    let useSkill: ChildSkill | null = null;
    if (isAssistDivine && assistSkillCd.current <= 0) {
      useSkill = assistSkillCd.skill!;
    }
    const skillName = useSkill?.name || '普通攻击';
    const mul = useSkill?.multiplier ?? 1.0;
    const elem = useSkill?.element ?? null;
    const ignoreDef = useSkill?.ignoreDef || 0;
    const hits = useSkill?.hitCount || 1;

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
      tgt.stats.hp -= r.damage;
      totalDealt += r.damage;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'assist', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] ${assist.name}·助战${useSkill ? `施展【${skillName}】` : ''}攻击了${tgt.stats.name}，${critText}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'assist', ...snap() });
      }
    }

    // 子女吸血
    if (totalDealt > 0 && assist.lifesteal > 0 && assist.hp > 0) {
      const heal = Math.floor(totalDealt * assist.lifesteal);
      if (heal > 0 && assist.hp < assist.maxHp) {
        const actual = Math.min(heal, assist.maxHp - assist.hp);
        assist.hp += actual;
        logs.push({ turn, text: `  ${assist.name}·助战【吸血】回复 ${actual} 点气血`, type: 'buff', actor: 'assist', ...snap() });
      }
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

    if (hits > 1) {
      logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}施展了【${skillName}】(${hits}段) → ${tgtName}!`, type: 'crit', actor: 'monster', ...snap() });
    }
    for (let h = 0; h < hits; h++) {
      const perMul = hits > 1 ? skillMul / hits : skillMul;
      const r = calculateDamage(m.stats, pick.ref, perMul, skillElem);
      if (r.damage === 0) {
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}的攻击被${tgtName}闪避了`, type: 'normal', actor: 'monster', ...snap() });
        continue;
      }
      pick.ref.hp -= r.damage;
      const critText = r.isCrit ? '会心!' : '';
      if (hits > 1) {
        logs.push({ turn, text: `  第${h + 1}段 ${critText}对${tgtName}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'monster', ...snap() });
      } else {
        logs.push({ turn, text: `[第${turn}回合] ${m.stats.name}${mSkill ? '施展【' + skillName + '】' : ''}攻击了${tgtName}，${critText}造成 ${r.damage} 点伤害`, type: r.isCrit ? 'crit' : 'normal', actor: 'monster', ...snap() });
      }
      if (pick.ref.hp <= 0) {
        pick.ref.hp = 0;
        if (pick.isPlayer) {
          // 玩家死 → 战斗失败
        } else {
          logs.push({ turn, text: `${assist.name}·助战倒下了`, type: 'death', actor: 'assist', ...snap() });
        }
        break;
      }
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
        if (player.hp > 0) playerAction(turn);
      } else if (ac.kind === 'assist') {
        if (!assist._isNoop && assist.hp > 0) assistAction(turn);
      } else {
        const m = monsters[ac.idx];
        if (m && m.alive && m.stats.hp > 0) monsterAction(m, turn);
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
