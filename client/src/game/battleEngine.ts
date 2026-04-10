import type { BattlerStats, BattleLogEntry, BattleResult, MonsterTemplate, MonsterBattleInfo, DropItem, CharacterData } from './types';
import { getElementMultiplier } from './data';
import { generateEquipment } from './equipData';

// 已装备功法信息（传入战斗引擎用）
export type DebuffType = 'burn' | 'poison' | 'bleed' | 'freeze' | 'stun' | 'slow' | 'brittle' | 'atk_down' | 'root' | 'silence';
export type BuffType = 'atk_up' | 'def_up' | 'spd_up' | 'crit_up' | 'shield' | 'regen' | 'reflect' | 'immune';

export interface SkillDebuffInfo {
  type: DebuffType;
  chance: number;
  duration: number;
  value?: number;
}

export interface SkillBuffInfo {
  type: BuffType;
  duration: number;
  value?: number;
  valuePercent?: number;
}

export interface SkillRefInfo {
  name: string;
  multiplier: number;
  cdTurns?: number;
  element: string | null;
  debuff?: SkillDebuffInfo;
  buff?: SkillBuffInfo;
  ignoreDef?: number;
}

export interface EquippedSkillInfo {
  activeSkill: SkillRefInfo | null;
  divineSkills: SkillRefInfo[];
  passiveEffects: {
    atkPercent: number; defPercent: number; hpPercent: number; spdPercent: number;
    critRate: number; critDmg: number; dodge: number; lifesteal: number;
    resistFire: number; resistWater: number; resistWood: number; resistMetal: number; resistEarth: number; resistCtrl: number;
    regenPerTurn: number; damageReductionFlat: number; reflectPercent: number;
    poisonOnHitTaken?: number; burnOnHitTaken?: number; reflectOnCrit?: number;
    reviveOnce?: boolean; skillCdReduction?: number;
  };
}

// 战斗中的 debuff 状态
interface ActiveDebuff {
  type: DebuffType;
  remaining: number;
  damagePerTurn: number;  // 仅 burn/poison/bleed
  value?: number;          // brittle (DEF降低%) / atk_down (ATK降低%)
}

interface ActiveBuff {
  type: BuffType;
  remaining: number;
  value?: number;
  valuePercent?: number;
}

// 洞府战斗加成
export interface CaveBonusInfo {
  skillRate: number;     // 功法掉率加成 %
  equipQuality: number;  // 装备品质偏移
}

let _caveBonus: CaveBonusInfo = { skillRate: 0, equipQuality: 0 };
export function setCaveBonus(b: CaveBonusInfo) {
  _caveBonus = b;
}

// 装备的福缘加成 (百分比)
let _equipLuck = 0;
export function setEquipLuck(luck: number) {
  _equipLuck = luck;
}

// 装备的灵气浓度加成 (百分比)
let _spiritDensity = 0;
export function setSpiritDensity(v: number) {
  _spiritDensity = v;
}
export function getSpiritDensity(): number {
  return _spiritDensity;
}

// 装备的战斗扩展属性
let _equipCombatStats = { armorPen: 0, accuracy: 0, elementDmg: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 } };
export function setEquipCombatStats(stats: typeof _equipCombatStats) {
  _equipCombatStats = stats;
}

// 随机数辅助
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 根据怪物模板生成战斗属性（含浮动）
export function generateMonsterStats(template: MonsterTemplate): BattlerStats {
  const fluctuation = 0.15;
  const power = template.power * randFloat(1 - fluctuation, 1 + fluctuation);

  // 根据role分配属性
  const ratios: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    balanced: { hp: 0.30, atk: 0.30, def: 0.25, spd: 0.15 },
    tank:     { hp: 0.40, atk: 0.15, def: 0.35, spd: 0.10 },
    dps:      { hp: 0.20, atk: 0.45, def: 0.15, spd: 0.20 },
    speed:    { hp: 0.20, atk: 0.25, def: 0.15, spd: 0.40 },
    boss:     { hp: 0.35, atk: 0.30, def: 0.25, spd: 0.10 },
  };

  const r = ratios[template.role] || ratios.balanced;
  const maxHp = Math.floor(power * r.hp * 10);

  // 怪物对自己属性有 40% 抗性, 控制抗性 10%
  const monsterResists = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ctrl: 0.10 };
  if (template.element && template.element in monsterResists) {
    (monsterResists as any)[template.element] = 0.40;
  }

  return {
    name: template.name,
    maxHp,
    hp: maxHp,
    atk: Math.floor(power * r.atk),
    def: Math.floor(power * r.def * 0.6),
    spd: Math.floor(power * r.spd * 0.3),
    crit_rate: 0.05,
    crit_dmg: 1.5,
    dodge: 0,
    lifesteal: 0,
    element: template.element,
    resists: monsterResists,
  };
}

// 根据角色数据生成战斗属性
export function characterToBattler(char: CharacterData): BattlerStats {
  return {
    name: char.name,
    maxHp: char.max_hp,
    hp: char.max_hp,
    atk: char.atk,
    def: char.def,
    spd: char.spd,
    crit_rate: Number(char.crit_rate),
    crit_dmg: Number(char.crit_dmg),
    dodge: Number(char.dodge),
    lifesteal: Number(char.lifesteal),
    element: char.spiritual_root,
    resists: {
      metal: Number(char.resist_metal || 0),
      wood:  Number(char.resist_wood  || 0),
      water: Number(char.resist_water || 0),
      fire:  Number(char.resist_fire  || 0),
      earth: Number(char.resist_earth || 0),
      ctrl:  Number(char.resist_ctrl  || 0),
    },
    spiritualRoot: char.spiritual_root,
  };
}

// 计算伤害
function calculateDamage(
  attacker: BattlerStats,
  defender: BattlerStats,
  skillMultiplier: number = 1.0,
  skillElement: string | null = null,
  ignoreDef: number = 0,
  ignoreDodge: boolean = false
): { damage: number; isCrit: boolean } {
  const useElement = skillElement || attacker.element;
  const elementMulti = getElementMultiplier(useElement, defender.element);

  let resistFactor = 1.0;
  if (useElement && defender.resists) {
    const r = (defender.resists as any)[useElement] || 0;
    resistFactor = 1.0 - Math.min(0.7, r);
  }

  // 无视防御 (技能 ignoreDef + 装备 armorPen)
  const totalArmorPen = ignoreDef + (attacker.armorPen || 0) / 100;
  const effectiveDef = defender.def * Math.max(0, 1 - totalArmorPen);
  const atkDefRatio = attacker.atk / (attacker.atk + effectiveDef * 0.5);

  // 元素强化加成
  let elementDmgBonus = 1.0;
  if (useElement && attacker.elementDmg) {
    const ed = (attacker.elementDmg as any)[useElement] || 0;
    elementDmgBonus = 1 + ed / 100;
  }

  let damage = attacker.atk * skillMultiplier * elementMulti * resistFactor * atkDefRatio * elementDmgBonus;

  const isCrit = Math.random() < attacker.crit_rate;
  if (isCrit) {
    damage *= attacker.crit_dmg;
  }

  // 闪避: 受命中影响 (effective_dodge = max(0, dodge - accuracy))
  if (!ignoreDodge) {
    const effectiveDodge = Math.max(0, defender.dodge - (attacker.accuracy || 0) / 100);
    if (Math.random() < effectiveDodge) {
      return { damage: 0, isCrit: false };
    }
  }

  damage = Math.max(1, Math.floor(damage));
  return { damage, isCrit };
}

// 怪物技能描述（根据tier和属性生成）
function getMonsterSkills(template: MonsterTemplate): string[] {
  const skills: string[] = ['普通攻击'];
  const tier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const elem = template.element;
  const elemNames: Record<string, string> = { fire: '火', water: '水', wood: '木', metal: '金', earth: '土' };
  const eName = elem ? elemNames[elem] || '' : '';

  if (tier >= 1 && elem) {
    const t1Skills: Record<string, string> = {
      fire: '喷火 - 造成火属性伤害，15%灼烧2回合',
      water: '水箭术 - 造成水属性伤害，20%减速2回合',
      wood: '毒液喷射 - 造成木属性伤害，25%中毒2回合',
      metal: '利爪 - 造成金属性伤害，15%流血2回合',
      earth: '飞石术 - 造成土属性伤害，15%脆弱2回合',
    };
    if (t1Skills[elem]) skills.push(t1Skills[elem]);
  }
  if (tier >= 3 && elem) {
    skills.push(`${eName}系强化攻击 - 高倍率${eName}属性伤害`);
  }
  if (tier >= 5) {
    skills.push('狂暴 - 攻击+40%，防御-20%');
  }
  if (template.role === 'boss') {
    skills.push('首领被动 - 气血低于30%时攻击+30%');
  }
  return skills;
}

// 生成怪物战斗信息
export function buildMonsterInfo(template: MonsterTemplate, stats: BattlerStats): MonsterBattleInfo {
  return {
    name: template.name,
    element: template.element,
    power: template.power,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    role: template.role,
    skills: getMonsterSkills(template),
  };
}

// 执行一场战斗
export function runBattle(
  playerStats: BattlerStats,
  monsterStats: BattlerStats,
  monsterTemplate: MonsterTemplate,
  equippedSkills?: EquippedSkillInfo
): BattleResult {
  const logs: BattleLogEntry[] = [];
  const player = { ...playerStats, hp: playerStats.maxHp };
  const monster = { ...monsterStats };
  const maxTurns = 50;
  const baseAtk = player.atk;
  const baseDef = player.def;
  const baseSpd = player.spd;

  // 应用被动功法加成
  if (equippedSkills?.passiveEffects) {
    const p = equippedSkills.passiveEffects;
    player.atk = Math.floor(player.atk * (1 + p.atkPercent / 100));
    player.def = Math.floor(player.def * (1 + p.defPercent / 100));
    player.maxHp = Math.floor(player.maxHp * (1 + p.hpPercent / 100));
    player.spd = Math.floor(player.spd * (1 + (p.spdPercent || 0) / 100));
    player.hp = player.maxHp;
    player.crit_rate += p.critRate;
    player.crit_dmg += p.critDmg;
    player.dodge += p.dodge || 0;
    player.lifesteal += p.lifesteal || 0;
  }

  // 应用装备战斗扩展属性
  player.armorPen = _equipCombatStats.armorPen;
  player.accuracy = _equipCombatStats.accuracy;
  player.elementDmg = _equipCombatStats.elementDmg;

  const activeSkill: SkillRefInfo = equippedSkills?.activeSkill || { name: '基础剑法', multiplier: 1.0, element: null };
  // 神通 CD 受 道心通明 影响 (-N)
  const cdReduction = equippedSkills?.passiveEffects.skillCdReduction || 0;
  const divineCds: number[] = (equippedSkills?.divineSkills || []).map(() => 0);

  const monsterDebuffs: ActiveDebuff[] = [];
  const playerBuffs: ActiveBuff[] = [];
  let playerShield = 0;
  let reviveAvailable = equippedSkills?.passiveEffects.reviveOnce || false;

  function snap(): Pick<BattleLogEntry, 'playerHp' | 'playerMaxHp' | 'monsterHp' | 'monsterMaxHp'> {
    return {
      playerHp: Math.max(0, player.hp),
      playerMaxHp: player.maxHp,
      monsterHp: Math.max(0, monster.hp),
      monsterMaxHp: monster.maxHp,
    };
  }

  function debuffName(type: string): string {
    return ({ burn: '灼烧', poison: '中毒', bleed: '流血', freeze: '冻结', stun: '眩晕', slow: '减速', brittle: '脆弱', atk_down: '攻击削弱', root: '束缚', silence: '封印' } as any)[type] || type;
  }

  function buffName(type: string): string {
    return ({ atk_up: '攻击提升', def_up: '防御提升', spd_up: '速度提升', crit_up: '暴击提升', shield: '护盾', regen: '持续回血', reflect: '伤害反弹', immune: '免疫控制' } as any)[type] || type;
  }

  // 应用 buff (玩家自身)
  function applyBuff(buff: SkillBuffInfo, turn: number) {
    const exist = playerBuffs.find(b => b.type === buff.type);
    if (exist) {
      exist.remaining = buff.duration;
      exist.value = buff.value;
      exist.valuePercent = buff.valuePercent;
    } else {
      playerBuffs.push({ type: buff.type, remaining: buff.duration, value: buff.value, valuePercent: buff.valuePercent });
    }
    if (buff.type === 'shield' && buff.value !== undefined) {
      playerShield = Math.floor(baseAtk * buff.value);
    }
    logs.push({ turn, text: `[第${turn}回合] 你获得了【${buffName(buff.type)}】`, type: 'buff', ...snap() });
  }

  // 触发 debuff (对怪物)
  function tryApplyDebuff(skill: { debuff?: SkillDebuffInfo }, casterAtk: number, target: BattlerStats, turn: number) {
    if (!skill.debuff) return;
    let chance = skill.debuff.chance;
    const debuff = skill.debuff;
    const controlTypes = ['freeze', 'stun', 'root', 'silence'];
    const isControl = controlTypes.includes(debuff.type);

    // 命中率: 控制类用 ctrl 抗性,DOT 用对应属性抗性
    if (target.resists) {
      if (isControl) {
        chance *= (1 - Math.min(0.7, target.resists.ctrl || 0));
      } else {
        const elemMap: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
        const elemKey = elemMap[debuff.type];
        if (elemKey) {
          const r = (target.resists as any)[elemKey] || 0;
          chance *= (1 - Math.min(0.7, r));
        }
      }
    }

    if (Math.random() >= chance) return;

    // 持续时间也受抗性影响
    let duration = debuff.duration;
    if (target.resists && !isControl) {
      const elemMap: Record<string, string> = { burn: 'fire', poison: 'wood', bleed: 'metal' };
      const elemKey = elemMap[debuff.type];
      if (elemKey) {
        const r = (target.resists as any)[elemKey] || 0;
        duration = Math.max(1, Math.floor(duration * (1 - Math.min(0.7, r))));
      }
    }

    // 计算每回合伤害(只 DOT 类)
    let dmg = 0;
    if (debuff.type === 'burn')   dmg = Math.floor(casterAtk * 0.15);
    if (debuff.type === 'poison') dmg = Math.floor(target.maxHp * 0.03);
    if (debuff.type === 'bleed')  dmg = Math.floor(casterAtk * 0.10);
    if (dmg > 0 && dmg < 1) dmg = 1;

    const exist = monsterDebuffs.find(d => d.type === debuff.type);
    if (exist) {
      exist.remaining = duration;
      exist.damagePerTurn = dmg;
      exist.value = debuff.value;
    } else {
      monsterDebuffs.push({ type: debuff.type, remaining: duration, damagePerTurn: dmg, value: debuff.value });
    }
    // 详细描述
    let detail = '';
    if (debuff.type === 'brittle' && debuff.value)  detail = ` 防御 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'atk_down' && debuff.value) detail = ` 攻击 -${(debuff.value * 100).toFixed(0)}%`;
    if (debuff.type === 'burn')                     detail = ` 每回合受 ${dmg} 火伤`;
    if (debuff.type === 'poison')                   detail = ` 每回合受 ${dmg} 毒伤`;
    if (debuff.type === 'bleed')                    detail = ` 每回合受 ${dmg} 流血伤害`;
    logs.push({
      turn,
      text: `[第${turn}回合] ${monster.name}陷入了【${debuffName(debuff.type)}】状态!${detail} (${duration}回合)`,
      type: 'normal',
      ...snap(),
    });
  }

  // 是否被控制无法行动 (freeze/stun)
  function isStunned(): boolean {
    return monsterDebuffs.some(d => d.type === 'freeze' || d.type === 'stun');
  }
  // 是否减速/束缚 (强制后攻)
  function isSlowed(): boolean {
    return monsterDebuffs.some(d => d.type === 'slow' || d.type === 'root');
  }
  // 玩家是否处于 immune buff (金钟罩) 下
  function playerImmune(): boolean {
    return playerBuffs.some(b => b.type === 'immune');
  }

  // 遭遇日志
  logs.push({ turn: 0, text: `你遭遇了【${monster.name}】`, type: 'system', ...snap() });

  for (let turn = 1; turn <= maxTurns; turn++) {
    // 回合开始: 结算怪物身上的 DOT debuff
    for (let i = monsterDebuffs.length - 1; i >= 0; i--) {
      const d = monsterDebuffs[i];
      if (d.damagePerTurn > 0) {
        monster.hp -= d.damagePerTurn;
        logs.push({ turn, text: `[第${turn}回合] ${monster.name}受到【${debuffName(d.type)}】伤害 ${d.damagePerTurn} 点`, type: 'normal', ...snap() });
      }
      d.remaining--;
      if (d.remaining <= 0) monsterDebuffs.splice(i, 1);
      if (monster.hp <= 0) {
        return buildResult(true, turn, monsterTemplate.exp, monsterTemplate, logs, monsterTemplate, monsterStats);
      }
    }

    // 回合开始: 结算玩家身上的 buff
    for (let i = playerBuffs.length - 1; i >= 0; i--) {
      const b = playerBuffs[i];
      if (b.type === 'regen' && b.valuePercent) {
        const heal = Math.floor(player.maxHp * b.valuePercent);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        logs.push({ turn, text: `[第${turn}回合] 你回复 ${heal} 点气血`, type: 'buff', ...snap() });
      }
      b.remaining--;
      if (b.remaining <= 0) {
        if (b.type === 'shield') playerShield = 0;
        playerBuffs.splice(i, 1);
      }
    }

    // 被动每回合回血
    if (equippedSkills?.passiveEffects.regenPerTurn && equippedSkills.passiveEffects.regenPerTurn > 0) {
      const heal = Math.floor(player.maxHp * equippedSkills.passiveEffects.regenPerTurn);
      if (heal > 0 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + heal);
      }
    }

    // 当前回合的有效属性 (受 buff/debuff 影响)
    let effectiveAtk = baseAtk;
    let effectiveDef = baseDef;
    let effectiveSpd = baseSpd;
    if (equippedSkills?.passiveEffects) {
      const p = equippedSkills.passiveEffects;
      effectiveAtk = Math.floor(baseAtk * (1 + p.atkPercent / 100));
      effectiveDef = Math.floor(baseDef * (1 + p.defPercent / 100));
      effectiveSpd = Math.floor(baseSpd * (1 + (p.spdPercent || 0) / 100));
    }
    for (const b of playerBuffs) {
      if (b.type === 'atk_up' && b.value)  effectiveAtk = Math.floor(effectiveAtk * (1 + b.value));
      if (b.type === 'def_up' && b.value)  effectiveDef = Math.floor(effectiveDef * (1 + b.value));
      if (b.type === 'spd_up' && b.value)  effectiveSpd = Math.floor(effectiveSpd * (1 + b.value));
    }
    player.atk = effectiveAtk;
    player.def = effectiveDef;
    player.spd = effectiveSpd;

    // 怪物的有效属性 (受 debuff 影响)
    let monsterEffectiveAtk = monsterStats.atk;
    let monsterEffectiveDef = monsterStats.def;
    for (const d of monsterDebuffs) {
      if (d.type === 'brittle' && d.value)  monsterEffectiveDef = Math.floor(monsterEffectiveDef * (1 - d.value));
      if (d.type === 'atk_down' && d.value) monsterEffectiveAtk = Math.floor(monsterEffectiveAtk * (1 - d.value));
    }
    monster.atk = monsterEffectiveAtk;
    monster.def = monsterEffectiveDef;

    // 决定先后手
    const slowed = isSlowed();
    const playerFirst = slowed ? false : player.spd >= monster.spd;

    const attacks: { isPlayer: boolean; attacker: BattlerStats; defender: BattlerStats }[] = playerFirst
      ? [{ isPlayer: true, attacker: player, defender: monster }, { isPlayer: false, attacker: monster, defender: player }]
      : [{ isPlayer: false, attacker: monster, defender: player }, { isPlayer: true, attacker: player, defender: monster }];

    for (const atk of attacks) {
      if (!atk.isPlayer) {
        // 怪物攻击: 被冻结/眩晕则跳过
        if (isStunned()) {
          logs.push({ turn, text: `[第${turn}回合] ${monster.name}处于控制中,无法行动`, type: 'normal', ...snap() });
          continue;
        }
        // 怪物普攻
        const result = calculateDamage(atk.attacker, atk.defender);
        if (result.damage === 0) {
          logs.push({ turn, text: `[第${turn}回合] ${monster.name}的攻击被你闪避了`, type: 'normal', ...snap() });
        } else {
          // 护盾吸收
          let dmg = result.damage;
          if (playerShield > 0) {
            const absorb = Math.min(playerShield, dmg);
            playerShield -= absorb;
            dmg -= absorb;
            if (absorb > 0) {
              logs.push({ turn, text: `[第${turn}回合] 护盾吸收了 ${absorb} 点伤害`, type: 'buff', ...snap() });
            }
          }
          // 减伤
          if (equippedSkills?.passiveEffects.damageReductionFlat) {
            dmg = Math.floor(dmg * (1 - equippedSkills.passiveEffects.damageReductionFlat));
          }
          // 金钟罩 immune: 期间受到伤害 -50%
          if (playerImmune()) {
            dmg = Math.floor(dmg * 0.5);
          }
          if (dmg > 0) {
            atk.defender.hp -= dmg;
            // 反弹
            const reflectBuff = playerBuffs.find(b => b.type === 'reflect');
            let reflectPercent = (reflectBuff?.value || 0) + (equippedSkills?.passiveEffects.reflectPercent || 0) / 100;
            // 暴击额外反弹
            if (result.isCrit && equippedSkills?.passiveEffects.reflectOnCrit) {
              reflectPercent += equippedSkills.passiveEffects.reflectOnCrit;
            }
            if (reflectPercent > 0) {
              const reflectDmg = Math.floor(dmg * reflectPercent);
              monster.hp -= reflectDmg;
              logs.push({ turn, text: `[第${turn}回合] 反弹 ${reflectDmg} 点伤害给 ${monster.name}`, type: 'normal', ...snap() });
            }
            logs.push({
              turn,
              text: result.isCrit
                ? `[第${turn}回合] ${monster.name}暴击！对你造成 ${dmg} 点伤害`
                : `[第${turn}回合] ${monster.name}攻击了你，造成 ${dmg} 点伤害`,
              type: result.isCrit ? 'crit' : 'normal',
              ...snap(),
            });
            // 被打触发型: 中毒/灼烧
            if (equippedSkills?.passiveEffects.poisonOnHitTaken && Math.random() < equippedSkills.passiveEffects.poisonOnHitTaken) {
              tryApplyDebuff({ debuff: { type: 'poison', chance: 1.0, duration: 2 } }, player.atk, monster, turn);
            }
            if (equippedSkills?.passiveEffects.burnOnHitTaken && Math.random() < equippedSkills.passiveEffects.burnOnHitTaken) {
              tryApplyDebuff({ debuff: { type: 'burn', chance: 1.0, duration: 2 } }, player.atk, monster, turn);
            }
          }
        }
      } else {
        // 玩家攻击
        // 检查神通是否可用 (被封印则不释放)
        let usedSkill: SkillRefInfo = activeSkill;
        let isDivine = false;
        const silenced = monsterDebuffs.some(d => d.type === 'silence');
        const divines = equippedSkills?.divineSkills || [];

        if (!silenced) {
          for (let i = 0; i < divines.length; i++) {
            if (divineCds[i] <= 0) {
              usedSkill = divines[i];
              divineCds[i] = Math.max(1, (divines[i].cdTurns || 5) - cdReduction);
              isDivine = true;
              break;
            }
          }
        }
        // CD 每回合减1
        for (let i = 0; i < divineCds.length; i++) {
          if (divineCds[i] > 0) divineCds[i]--;
        }

        // 灵根匹配加成
        let finalMultiplier = usedSkill.multiplier;
        let rootMatched = false;
        if (usedSkill.element && player.spiritualRoot && usedSkill.element === player.spiritualRoot) {
          finalMultiplier *= 1.2;
          rootMatched = true;
        }

        // 纯 buff 技能 (multiplier=0): 不计算伤害但仍然触发 buff/debuff
        if (finalMultiplier === 0) {
          if (usedSkill.buff) applyBuff(usedSkill.buff, turn);
          if (usedSkill.debuff) tryApplyDebuff(usedSkill, player.atk, monster, turn);
          logs.push({ turn, text: `[第${turn}回合] 你施展了【${usedSkill.name}】`, type: 'buff', ...snap() });
          continue;
        }

        // 如果怪物被束缚 (root),无视闪避
        const monsterRooted = monsterDebuffs.some(d => d.type === 'root');
        const result = calculateDamage(atk.attacker, atk.defender, finalMultiplier, usedSkill.element, usedSkill.ignoreDef, monsterRooted);

        if (result.damage === 0) {
          logs.push({ turn, text: `[第${turn}回合] 你的【${usedSkill.name}】被${monster.name}闪避了`, type: 'normal', ...snap() });
        } else {
          atk.defender.hp -= result.damage;

          if (player.lifesteal > 0) {
            const heal = Math.floor(result.damage * player.lifesteal);
            player.hp = Math.min(player.maxHp, player.hp + heal);
          }

          const prefix = isDivine ? '神通发动！' : (rootMatched ? '灵根共鸣！' : '');
          logs.push({
            turn,
            text: result.isCrit
              ? `[第${turn}回合] ${prefix}会心一击！【${usedSkill.name}】对${monster.name}造成 ${result.damage} 点暴击伤害`
              : `[第${turn}回合] ${prefix}你对${monster.name}施展了【${usedSkill.name}】，造成 ${result.damage} 点伤害`,
            type: isDivine ? 'crit' : (result.isCrit ? 'crit' : 'normal'),
            ...snap(),
          });

          // 命中后尝试附加 debuff 和自身 buff
          tryApplyDebuff(usedSkill, player.atk, monster, turn);
          if (usedSkill.buff) applyBuff(usedSkill.buff, turn);
        }
      }

      if (atk.defender.hp <= 0) {
        if (atk.isPlayer) {
          return buildResult(true, turn, monsterTemplate.exp, monsterTemplate, logs, monsterTemplate, monsterStats);
        } else {
          // 免死效果: 触发后保留 20% 血,只能触发一次
          if (reviveAvailable) {
            reviveAvailable = false;
            player.hp = Math.floor(player.maxHp * 0.20);
            logs.push({ turn, text: `[第${turn}回合] 【不灭金身】发动!免死保留 ${player.hp} 点气血!`, type: 'buff', ...snap() });
            continue;
          }
          return buildResult(false, turn, 0, 0, logs, monsterTemplate, monsterStats);
        }
      }
    }
  }

  logs.push({ turn: maxTurns, text: '战斗超时，你选择撤退', type: 'system', ...snap() });
  return buildResult(false, maxTurns, 0, 0, logs, monsterTemplate, monsterStats);
}

function buildResult(
  won: boolean,
  turns: number,
  exp: number | MonsterTemplate,
  spiritStoneOrTemplate: number | MonsterTemplate,
  logs: BattleLogEntry[],
  template: MonsterTemplate,
  monsterStats: BattlerStats
): BattleResult {
  const mInfo = buildMonsterInfo(template, monsterStats);

  if (!won) {
    logs.push({ turn: turns, text: '你的气血耗尽，陨落了…3回合后原地复活', type: 'death' });
    return { won: false, turns, expGained: 0, spiritStoneGained: 0, logs, drops: [], monsterInfo: mInfo };
  }

  const expGained = Math.floor(template.exp * randFloat(0.9, 1.1));
  const spiritStone = rand(template.spirit_stone_range[0], template.spirit_stone_range[1]);
  const drops = generateDrops(template);

  logs.push({
    turn: turns,
    text: `你击杀了${template.name}，获得 ${expGained} 修为、${spiritStone} 灵石`,
    type: 'kill',
  });

  for (const drop of drops) {
    logs.push({
      turn: turns,
      text: `${template.name}掉落了【${drop.name}】！`,
      type: 'loot',
    });
  }

  return { won: true, turns, expGained, spiritStoneGained: spiritStone, logs, drops, monsterInfo: mInfo };
}

// 掉落生成
function generateDrops(template: MonsterTemplate): DropItem[] {
  const drops: DropItem[] = [];
  const isBoss = template.role === 'boss';

  // 装备掉落 (受福缘加成)
  const mapTier = parseInt(template.drop_table.replace(/\D/g, '')) || 1;
  const luckMul = 1 + _equipLuck / 100;
  const equipRate = (isBoss ? 1.0 : (template.drop_table.includes('uncommon') ? 0.30 : 0.20)) * luckMul;
  if (Math.random() < equipRate) {
    const equip = generateEquipment(mapTier, isBoss);
    drops.push({
      name: equip.name,
      type: 'equipment',
      rarity: equip.rarity,
      equipData: equip,
    });
  }

  // 功法掉落 (洞府藏经阁 + 福缘加成)
  const baseSkillRate = isBoss ? 0.50 : 0.15;
  const skillRate = baseSkillRate * (1 + _caveBonus.skillRate / 100) * luckMul;
  if (Math.random() < skillRate) {
    // 按地图 tier 决定可掉落的功法
    let skills: string[];
    if (mapTier >= 9) {
      // T9-T10: 仙品优先
      skills = [
        '时光凝滞', '天罚雷劫', '道心通明', '五行归一',
        '万剑归宗', '地裂天崩', '噬魂大法', '九天玄火阵',
        '渊海之心', '战意沸腾', '不灭金身',
      ];
    } else if (mapTier >= 7) {
      // 天品 + 仙品
      skills = [
        '时光凝滞', '天罚雷劫',
        '万剑归宗', '地裂天崩', '噬魂大法', '九天玄火阵',
        '道心通明', '五行归一', '渊海之心', '战意沸腾', '不灭金身',
      ];
    } else if (mapTier >= 5) {
      // 地品
      skills = [
        '嗜血诀', '生生不息', '明镜止水',
        '破绽感知', '不动如山', '百毒不侵', '焚天之体',
      ];
    } else if (mapTier >= 3) {
      // 玄品
      skills = [
        '天火术', '霜冻新星', '厚土盾', '万藤缚', '金钟罩',
        '凌波微步', '铁布衫', '荆棘之体', '焚身火甲', '厚土心法',
      ];
    } else {
      // 灵品 (主修五行 + 基础被动)
      skills = [
        '风刃术', '缠藤术', '寒冰掌', '烈焰剑诀', '裂地拳',
        '金刚体', '焚体诀', '流水心法', '盘根术', '金身术',
      ];
    }
    drops.push({
      name: skills[rand(0, skills.length - 1)],
      type: 'skill',
      rarity: 'blue',
    });
  }

  // 灵草掉落
  const herbRate = (isBoss ? 0.80 : 0.30) * luckMul;
  if (Math.random() < herbRate) {
    // 根据怪物五行决定灵草种类
    const elementToHerb: Record<string, { id: string; name: string }> = {
      metal: { id: 'metal_herb',   name: '锐金草' },
      wood:  { id: 'wood_herb',    name: '青木叶' },
      water: { id: 'water_herb',   name: '玄水苔' },
      fire:  { id: 'fire_herb',    name: '赤焰花' },
      earth: { id: 'earth_herb',   name: '厚土参' },
    };
    let herbDef = template.element ? elementToHerb[template.element] : null;
    if (!herbDef) {
      // 无属性怪物掉通用灵草或仙灵草
      herbDef = isBoss && Math.random() < 0.30
        ? { id: 'spirit_grass', name: '仙灵草' }
        : { id: 'common_herb', name: '灵草' };
    }

    // 根据 tier 决定品质
    let qualityId = 'white', qualityName = '凡品';
    const r = Math.random();
    if (mapTier >= 7) {
      if (r < 0.4) { qualityId = 'gold';   qualityName = '天品'; }
      else         { qualityId = 'purple'; qualityName = '地品'; }
    } else if (mapTier >= 5) {
      if (r < 0.5) { qualityId = 'purple'; qualityName = '地品'; }
      else         { qualityId = 'blue';   qualityName = '玄品'; }
    } else if (mapTier >= 3) {
      if (r < 0.4) { qualityId = 'blue';   qualityName = '玄品'; }
      else         { qualityId = 'green';  qualityName = '灵品'; }
    } else {
      if (r < 0.20) { qualityId = 'green'; qualityName = '灵品'; }
      else          { qualityId = 'white'; qualityName = '凡品'; }
    }

    // Boss 提升一档
    if (isBoss) {
      const order = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
      const idx = Math.min(order.indexOf(qualityId) + 1, order.length - 1);
      qualityId = order[idx];
      const names = ['凡品', '灵品', '玄品', '地品', '天品', '仙品'];
      qualityName = names[idx];
    }

    drops.push({
      name: `${qualityName}·${herbDef.name}`,
      type: 'material',
      rarity: qualityId,
      equipData: { herb_id: herbDef.id, quality: qualityId, count: isBoss ? 3 : 1 },
    });
  }

  return drops;
}
