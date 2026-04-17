<template>
  <div class="equip-detail">
    <div class="tooltip-name" :style="{ color: nameColor }">
      {{ equip.name }}
      <span v-if="equip.enhance_level > 0" class="enhance-tag">+{{ equip.enhance_level }}</span>
    </div>
    <div v-if="equip.weapon_type" class="tooltip-weapon-type">
      类型: {{ weaponTypeName }}
    </div>
    <div class="tooltip-sub">
      阶位: T{{ equip.tier || 1 }} · {{ rarityName }}
    </div>
    <div v-if="showReqLevel" class="tooltip-sub" :style="reqLevelStyle">
      需要等级: Lv.{{ equip.req_level || 1 }}
    </div>
    <div class="tooltip-main">
      {{ statName(equip.primary_stat) }} +{{ enhancedPrimary }}
      <span v-if="equip.enhance_level > 0" style="color: var(--jade); font-size: 12px;">
        (强化+{{ enhanceBonus }})
      </span>
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

const props = defineProps<{
  equip: any
  /** 当前角色等级（用于需要等级红绿色提示，未传则不红绿化 = 沿用 tooltip-sub 默认色） */
  charLevel?: number
  /** 是否显示"需要等级"行 */
  showReqLevel?: boolean
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

const nameColor = computed(() => getRarityColor(props.equip.rarity))
const rarityName = computed(() => RARITY_NAMES[props.equip.rarity] || props.equip.rarity)
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
</style>
