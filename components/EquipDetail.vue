<template>
  <div class="equip-detail">
    <div class="tooltip-name" :class="{ 'legendary-name': isLegendary, 'boss-name': isBossTreasure }" :style="{ color: nameColor }">
      <span v-if="isBossTreasure" class="boss-treasure-mark" title="Boss 秘宝">◆</span>
      <span v-if="isLegendary" class="legendary-mark" title="元始天尊套装">❖</span>
      {{ equip.name }}
      <span v-if="equip.enhance_level > 0" class="enhance-tag">+{{ equip.enhance_level }}</span>
    </div>
    <div v-if="wuxingPrefixZh" class="tooltip-wuxing-prefix">
      <span class="wuxing-symbol">{{ wuxingPrefixZh }}</span>
    </div>
    <div v-if="equip.weapon_type" class="tooltip-weapon-type">
      类型: {{ weaponTypeName }}
    </div>
    <div class="tooltip-sub">
      阶位: T{{ equip.tier || 1 }} · {{ rarityName }}
      <span v-if="isV5" style="color: var(--ink-faint); font-size: 11px;">（V5）</span>
    </div>
    <div v-if="showReqLevel" class="tooltip-sub" :style="reqLevelStyle">
      需要等级: Lv.{{ equip.req_level || 1 }}
    </div>
    <div class="tooltip-main">
      {{ statName(equip.primary_stat) }} +{{ formatValue(equip.primary_stat, enhancedPrimary) }}
      <span v-if="equip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
        (强化+{{ formatValue(equip.primary_stat, enhanceBonus) }})
      </span>
    </div>
    <div v-if="equip.primary_stat_2 && equip.primary_value_2" class="tooltip-main" style="color: var(--gold-ink); opacity: 0.85;">
      {{ statName(equip.primary_stat_2) }} +{{ formatValue(equip.primary_stat_2, equip.primary_value_2) }}
      <span style="color: var(--ink-faint); font-size: 11px;">（固定）</span>
    </div>
    <!-- V5 五行链实时诊断（解释为什么亮/不亮） -->
    <div v-if="isV5 && wuxingDiagnosis" class="tooltip-wuxing-diagnosis">
      <!-- 第 1 行：前置 → 当前 + 相生判定 -->
      <div class="wx-diag-line">
        <span class="wx-diag-label">前置</span>
        <span v-if="wuxingDiagnosis.prevPrefixZh" class="wx-diag-chip">
          {{ wuxingDiagnosis.prevSlotName }}·{{ wuxingDiagnosis.prevPrefixZh }}
        </span>
        <span v-else class="wx-diag-chip wx-diag-empty">{{ wuxingDiagnosis.prevSlotName }} 空</span>
        <span class="wx-diag-arrow">→</span>
        <span class="wx-diag-chip wx-diag-self">
          {{ wuxingDiagnosis.slotName }}·{{ wuxingDiagnosis.prefixZh }}
        </span>
        <span class="wx-diag-reason" :class="{ 'wx-diag-ok': wuxingDiagnosis.isSheng, 'wx-diag-no': !wuxingDiagnosis.isSheng }">
          {{ wuxingDiagnosis.isSheng ? '✓' : '✗' }} {{ wuxingDiagnosis.shengReason }}
        </span>
      </div>
      <!-- 第 2 行：三档进度（链上已激活 X 件） -->
      <div class="wx-diag-line wx-diag-progress">
        <span class="wx-diag-label">链上</span>
        <span class="wx-diag-count">{{ wuxingDiagnosis.chainActiveCount }}/7 件已激活</span>
        <span class="wx-diag-tier" :class="{ 'wx-diag-tier-on': wuxingDiagnosis.affix_1_active }">
          ①{{ wuxingDiagnosis.affix_1_active ? '✓' : '✗' }}
        </span>
        <span class="wx-diag-tier" :class="{ 'wx-diag-tier-on': wuxingDiagnosis.affix_2_active }">
          ②{{ wuxingDiagnosis.affix_2_active ? '✓' : `✗ 需 ${wuxingDiagnosis.affix_2_threshold}` }}
        </span>
        <span class="wx-diag-tier" :class="{ 'wx-diag-tier-on': wuxingDiagnosis.affix_3_active }">
          ③{{ wuxingDiagnosis.affix_3_active ? '✓' : `✗ 需 ${wuxingDiagnosis.affix_3_threshold}` }}
        </span>
      </div>
    </div>
    <!-- V5 五行词条（暗词条，灰字未触发 / 蓝字触发） -->
    <div v-if="isV5 && wuxingAffixes.length > 0" class="tooltip-wuxing-affixes">
      <div v-for="(aff, i) in wuxingAffixes" :key="i"
           class="tooltip-wuxing-affix"
           :class="{ active: wuxingActivation && [wuxingActivation.affix_1_active, wuxingActivation.affix_2_active, wuxingActivation.affix_3_active][i] }">
        <span class="wx-affix-tier">{{ ['①','②','③'][i] }}</span>
        {{ statName(aff.stat) }} +{{ formatValue(aff.stat, aff.value) }}
      </div>
    </div>
    <div v-for="(sub, i) in subs" :key="i" class="tooltip-sub">
      {{ statName(sub.stat) }} +{{ formatValue(sub.stat, sub.value) }}
    </div>
    <div v-if="equip.weapon_type" class="tooltip-weapon-bonus">
      <div v-for="(line, i) in weaponBonusLines" :key="i" class="tooltip-sub" style="color: var(--gold-ink);">
        {{ line }}
      </div>
    </div>
    <div v-if="awaken" class="tooltip-awaken-row">
      ✦ 附灵·{{ awaken.name }}
      <span class="tooltip-awaken-desc">{{ awaken.desc }}</span>
    </div>
    <div v-if="setInfo" class="tooltip-set-row">
      ❖ {{ setInfo.name }}
      <span v-if="setProgress > 0" class="tooltip-set-progress" :class="{ 'set-active': activeTier > 0 }">
        （已穿戴 {{ setProgress }} 件{{ activeTier > 0 ? ` · ${activeTier} 件套激活` : '' }}）
      </span>
      <div class="tooltip-set-tiers">
        <div v-for="t in setInfo.tiers" :key="t.count" class="tooltip-set-tier" :class="{ 'set-tier-active': setProgress >= t.count }">
          <b>{{ t.count }} 件套</b> {{ t.desc }}
        </div>
      </div>
    </div>
    <!-- V5 元始天尊套装进度 -->
    <div v-if="isLegendary" class="tooltip-legendary-row">
      ❖ 元始天尊
      <span class="tooltip-set-progress" :class="{ 'set-active': yuanshiCount && yuanshiCount > 0 }">
        （已穿戴 {{ yuanshiCount || 0 }} / 7 件）
      </span>
      <div class="tooltip-set-tiers">
        <div v-for="t in yuanshiTiers" :key="t.pieces" class="tooltip-set-tier" :class="{ 'set-tier-active': (yuanshiCount || 0) >= t.pieces }">
          <b>{{ t.pieces }} 件套</b> {{ t.description_zh }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  getRarityColor, getWeaponTypeDef,
  getEnhancedPrimaryValue, getEnhanceBonus,
  STAT_NAMES, PERCENT_STATS,
} from '~/game/equipData'
import { describeAwakenEffect, type AwakenEffect } from '~/game/awakenData'
import { EQUIP_SET_MAP, getActiveTier } from '~/game/equipSetData'

const props = defineProps<{
  equip: any
  /** 当前角色等级（用于需要等级红绿色提示，未传则不红绿化 = 沿用 tooltip-sub 默认色） */
  charLevel?: number
  /** 是否显示"需要等级"行 */
  showReqLevel?: boolean
  /** 已穿戴该 set_id 的装备件数（外部传入，用于进度/激活高亮）；未传则为 0 */
  equippedSetCount?: number
  /** V5 五行词条触发状态（父组件传入；未传则 3 条都视为未触发） */
  wuxingActivation?: { affix_1_active: boolean; affix_2_active: boolean; affix_3_active: boolean }
  /** V5 五行链实时诊断（父组件传入；用于解释每条词条为什么亮 / 为什么不亮） */
  wuxingDiagnosis?: {
    slotName: string
    prefixZh: string
    isDual: boolean
    isYuanshi: boolean
    prevSlotName: string
    prevPrefixZh: string | null
    isSheng: boolean
    shengReason: string
    affix_1_active: boolean
    affix_2_active: boolean
    affix_3_active: boolean
    chainActiveCount: number
    affix_2_threshold: number
    affix_3_threshold: number
  }
  /** 已穿戴元始天尊件数（V5 套装进度） */
  yuanshiCount?: number
}>()

const RARITY_NAMES: Record<string, string> = {
  white: '凡器', green: '灵器', blue: '法器', purple: '灵宝', gold: '仙器', red: '太古',
}

function statName(stat: string): string {
  return STAT_NAMES[stat] || stat
}

// 与 pages/index.vue 中 formatStatValue 保持一致
function formatValue(stat: string, value: number): string {
  if (PERCENT_STATS.has(stat)) return value + '%'
  return String(value)
}

// V5 传奇装备 > V5 boss 秘宝 > 普通品质
const nameColor = computed(() => {
  if (props.equip?.legendary_set_id === 'yuanshi_tianzun') return '#ffd700'  // 炫金
  if (props.equip?.is_boss_treasure === true) return '#ff6faa'                // 亮粉
  return getRarityColor(props.equip.rarity)
})
const rarityName = computed(() => {
  if (props.equip?.legendary_set_id === 'yuanshi_tianzun') return '传奇'
  if (props.equip?.is_boss_treasure === true) return '秘宝'
  return RARITY_NAMES[props.equip.rarity] || props.equip.rarity
})
const weaponTypeName = computed(() => getWeaponTypeDef(props.equip.weapon_type)?.name || '')
const enhancedPrimary = computed(() => getEnhancedPrimaryValue(props.equip.primary_value, props.equip.enhance_level || 0))
const enhanceBonus = computed(() => getEnhanceBonus(props.equip.primary_value, props.equip.enhance_level || 0))

// 需要等级颜色：传了 charLevel 才做红绿判断；未传沿用默认 tooltip-sub 色
const reqLevelStyle = computed(() => {
  if (props.charLevel === undefined || props.charLevel === null) return {}
  const ok = props.charLevel >= (props.equip.req_level || 1)
  return { color: ok ? 'var(--jade)' : 'var(--cinnabar)' }
})

// 与 pages/index.vue 中 parseSubs 保持一致（JSON.parse 加 try/catch）
const subs = computed(() => {
  const raw = props.equip.sub_stats
  if (!raw) return []
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return raw
})

// 与 pages/index.vue 中 formatWeaponBonus 严格对齐 — 走 getWeaponTypeDef().bonus
const weaponBonusLines = computed(() => {
  const def = getWeaponTypeDef(props.equip.weapon_type)
  if (!def) return []
  const b: any = def.bonus
  const lines: string[] = []
  if (b.ATK_percent)    lines.push(`攻击 +${b.ATK_percent}%`)
  if (b.SPD_percent)    lines.push(`身法 +${b.SPD_percent}%`)
  if (b.SPIRIT_percent) lines.push(`神识 +${b.SPIRIT_percent}%`)
  if (b.CRIT_RATE_flat) lines.push(`会心率 +${b.CRIT_RATE_flat}%`)
  if (b.CRIT_DMG_flat)  lines.push(`会心伤害 +${b.CRIT_DMG_flat}%`)
  if (b.LIFESTEAL_flat) lines.push(`吸血 +${b.LIFESTEAL_flat}%`)
  return lines
})

const awaken = computed<{ name: string; desc: string } | null>(() => {
  const raw = props.equip.awaken_effect
  if (!raw) return null
  let eff: AwakenEffect
  try {
    eff = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
  return { name: eff.name, desc: describeAwakenEffect(eff) }
})

// 套装信息（命中 set_id 时展示套装详情）
const setInfo = computed(() => {
  const sid = props.equip?.set_id
  if (!sid) return null
  return EQUIP_SET_MAP[sid] || null
})
const setProgress = computed(() => props.equippedSetCount || 0)
const activeTier = computed(() => getActiveTier(setProgress.value))

// ===== V5.0.2 装备字段 =====
const isV5 = computed(() => props.equip?.equipment_version === 5)
const isLegendary = computed(() => props.equip?.legendary_set_id === 'yuanshi_tianzun')
const isBossTreasure = computed(() => props.equip?.is_boss_treasure === true)

// 五行用彩色圆点表示；五元素全包用 ☯️（小夏 2026-05-12）
const WUXING_SYMBOL: Record<string, string> = {
  metal: '⚪', // 金 — 银白
  wood:  '🟢', // 木 — 绿
  water: '🔵', // 水 — 蓝
  fire:  '🔴', // 火 — 红
  earth: '🟡', // 土 — 黄
}
const wuxingPrefixZh = computed(() => {
  const raw = props.equip?.wuxing_prefix
  if (!raw) return ''
  const arr: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : [])
  if (arr.length === 0) return ''
  if (arr.length === 5) return '☯️'  // 元始天尊【五行】全包
  return arr.map(p => WUXING_SYMBOL[p] || p).join(' ')
})

// 元始天尊套装 4 档效果（不导入 balance-v5.ts 避免 SSR 路径问题，写常量）
const yuanshiTiers = [
  { pieces: 1, description_zh: '攻/防/血/神识/身法 +10%' },
  { pieces: 3, description_zh: '神通伤害 +10%' },
  { pieces: 5, description_zh: '全神通 cd -1；释放神通时 30% 概率刷新 cd 最短的神通' },
  { pieces: 7, description_zh: '行动时 10% 概率天尊气场，全体震慑 1 回合（眩晕，无视免控必中）' },
]

const wuxingAffixes = computed(() => {
  const raw = props.equip?.wuxing_affixes
  if (!raw) return []
  let arr: any[] = []
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  } else if (Array.isArray(raw)) {
    arr = raw
  }
  return arr.filter(a => a && typeof a.stat === 'string')
})
</script>

<style scoped>
/* 样式严格对齐 pages/index.vue 原版定义 */
.equip-detail { display: flex; flex-direction: column; }

.tooltip-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}
.enhance-tag {
  font-size: 12px;
  color: var(--gold-ink);
  margin-left: 4px;
}
.tooltip-weapon-type {
  font-size: 12px;
  color: var(--ink-faint);
  margin-bottom: 4px;
}
.tooltip-main {
  font-size: 14px;
  color: var(--gold-ink);
  margin-bottom: 4px;
}
.tooltip-sub {
  font-size: 13px;
  color: var(--ink-light);
  margin-bottom: 2px;
}
.tooltip-weapon-bonus {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(232, 204, 138, 0.2);
}

/* 附灵行（沿用 pages/index.vue:.tooltip-awaken-row 原定义） */
.tooltip-awaken-row {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 170, 0, 0.4);
  color: #FFAA00;
  font-weight: 600;
  font-size: 13px;
}
.tooltip-awaken-desc {
  display: block;
  font-weight: normal;
  color: rgba(255, 170, 0, 0.75);
  font-size: 12px;
  margin-top: 2px;
}

/* 套装信息行 */
.tooltip-set-row {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed rgba(120, 200, 255, 0.4);
  color: #78c8ff;
  font-weight: 600;
  font-size: 13px;
}
.tooltip-set-progress {
  font-weight: normal;
  font-size: 12px;
  color: rgba(120, 200, 255, 0.7);
  margin-left: 4px;
}
.tooltip-set-progress.set-active {
  color: #ffd35e;
  font-weight: 600;
  text-shadow: 0 0 4px rgba(255, 211, 94, 0.5);
}
.tooltip-set-tiers {
  margin-top: 4px;
  font-weight: normal;
}
.tooltip-set-tier {
  font-size: 12px;
  color: rgba(120, 200, 255, 0.55);
  margin-bottom: 2px;
  line-height: 1.4;
}
.tooltip-set-tier b {
  color: rgba(120, 200, 255, 0.8);
  margin-right: 4px;
}
.tooltip-set-tier.set-tier-active {
  color: #ffd35e;
}
.tooltip-set-tier.set-tier-active b {
  color: #ffd35e;
  text-shadow: 0 0 4px rgba(255, 211, 94, 0.5);
}

/* V5 五行链实时诊断（在五行词条之前，解释 ① ② ③ 为什么亮 / 不亮） */
.tooltip-wuxing-diagnosis {
  margin-top: 4px;
  padding: 6px 8px;
  background: rgba(60, 90, 140, 0.10);
  border-left: 2px solid rgba(120, 200, 255, 0.35);
  border-radius: 3px;
  font-size: 12px;
  line-height: 1.65;
}
.wx-diag-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.wx-diag-progress { margin-top: 3px; }
.wx-diag-label {
  color: rgba(180, 180, 200, 0.65);
  font-size: 11px;
  margin-right: 2px;
}
.wx-diag-chip {
  padding: 1px 6px;
  background: rgba(120, 200, 255, 0.15);
  border-radius: 8px;
  color: var(--ink-light);
  white-space: nowrap;
}
.wx-diag-chip.wx-diag-empty {
  background: rgba(180, 180, 180, 0.10);
  color: rgba(180, 180, 180, 0.55);
}
.wx-diag-chip.wx-diag-self {
  background: rgba(255, 215, 94, 0.18);
  color: #ffd35e;
  font-weight: 600;
}
.wx-diag-arrow {
  color: rgba(180, 180, 200, 0.55);
  font-weight: 600;
  margin: 0 2px;
}
.wx-diag-reason {
  margin-left: 4px;
  font-size: 11.5px;
}
.wx-diag-reason.wx-diag-ok  { color: #6acf6a; }
.wx-diag-reason.wx-diag-no  { color: #d05d5d; }
.wx-diag-count {
  color: rgba(180, 200, 220, 0.85);
  margin-right: 6px;
}
.wx-diag-tier {
  padding: 1px 5px;
  background: rgba(160, 160, 160, 0.10);
  border-radius: 8px;
  color: rgba(180, 180, 180, 0.55);
  font-size: 11px;
}
.wx-diag-tier.wx-diag-tier-on {
  background: rgba(120, 200, 255, 0.20);
  color: #78c8ff;
  font-weight: 600;
}
/* 五行词条前的 ① ② ③ 序号（与诊断条对应） */
.wx-affix-tier {
  display: inline-block;
  width: 16px;
  color: rgba(180, 180, 200, 0.55);
  font-size: 12px;
  margin-right: 2px;
}
.tooltip-wuxing-affix.active .wx-affix-tier {
  color: #78c8ff;
}

/* V5 五行词条（暗词条）：默认灰字未触发，蓝字触发 */
.tooltip-wuxing-affixes {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed rgba(120, 200, 255, 0.2);
}
.tooltip-wuxing-affix {
  font-size: 13px;
  color: rgba(180, 180, 180, 0.55);  /* 灰字 — 未触发 */
  margin-bottom: 2px;
}
.tooltip-wuxing-affix.active {
  color: #78c8ff;  /* 蓝字 — 已触发 */
  text-shadow: 0 0 4px rgba(120, 200, 255, 0.4);
}

/* V5 前缀行：纯符号，无文字标签 */
.tooltip-wuxing-prefix {
  font-size: 15px;
  letter-spacing: 2px;
  margin-bottom: 4px;
  line-height: 1.2;
}
.wuxing-symbol {
  filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.3));
}

/* V5 boss 秘宝 / 元始天尊 标识 — 加动画 */
.boss-treasure-mark {
  display: inline-block;
  color: #ff6faa;
  font-size: 14px;
  margin-right: 4px;
  text-shadow: 0 0 4px rgba(255, 111, 170, 0.7), 0 0 8px rgba(255, 111, 170, 0.4);
  animation: detail-boss-pulse 1.8s ease-in-out infinite;
}
@keyframes detail-boss-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.2); opacity: 0.85; }
}
.legendary-mark {
  display: inline-block;
  color: #ffd700;
  font-size: 14px;
  margin-right: 4px;
  text-shadow: 0 0 6px rgba(255, 215, 0, 0.9), 0 0 14px rgba(255, 165, 0, 0.6);
  animation: detail-legendary-spin 3s ease-in-out infinite;
}
@keyframes detail-legendary-spin {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50%      { transform: rotate(180deg) scale(1.25); }
}

/* V5 元始天尊装备名：炫金流光文字 */
.tooltip-name.legendary-name {
  background: linear-gradient(90deg, #ffd700 0%, #fff4a3 25%, #ffaa00 50%, #fff4a3 75%, #ffd700 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: legendary-text-shine 3s linear infinite;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.5));
}
@keyframes legendary-text-shine {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

/* V5 boss 秘宝装备名：粉色脉冲发光 */
.tooltip-name.boss-name {
  text-shadow: 0 0 6px rgba(255, 111, 170, 0.6);
  animation: boss-name-glow 2.4s ease-in-out infinite;
}
@keyframes boss-name-glow {
  0%, 100% { text-shadow: 0 0 6px rgba(255, 111, 170, 0.6); }
  50%      { text-shadow: 0 0 12px rgba(255, 111, 170, 0.9), 0 0 20px rgba(255, 111, 170, 0.4); }
}
/* V5 元始天尊套装行（炫金色调） */
.tooltip-legendary-row {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 215, 0, 0.4);
  color: #ffd700;
  font-weight: 600;
  font-size: 13px;
  text-shadow: 0 0 4px rgba(255, 215, 0, 0.3);
}
</style>
