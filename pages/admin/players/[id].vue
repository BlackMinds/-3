<template>
  <AdminShell title="玩家详情">
    <div class="admin-row admin-mb">
      <NuxtLink to="/admin/players" class="admin-btn ghost small">← 返回列表</NuxtLink>
      <NuxtLink v-if="data" :to="`/admin/orders?character_id=${data.character.id}`" class="admin-btn small">
        给该玩家发货
      </NuxtLink>
    </div>

    <div v-if="loading" class="admin-loading">加载中...</div>
    <div v-else-if="!data" class="admin-empty">玩家不存在</div>
    <template v-else>
      <!-- 基础信息 -->
      <div class="admin-card">
        <div class="admin-row between admin-mb">
          <div>
            <h2 style="margin: 0;">{{ c.name }}</h2>
            <p class="text-dim" style="margin: 4px 0 0;">
              ID #{{ c.id }} · 账号 {{ c.accountName }} ·
              <span v-if="c.userStatus === 1" class="admin-tag success">正常</span>
              <span v-else class="admin-tag danger">封禁</span>
            </p>
          </div>
          <div class="admin-row admin-gap-sm">
            <span class="admin-tag info">{{ c.title || '无称号' }}</span>
          </div>
        </div>

        <div class="admin-grid">
          <div v-for="item in baseStats" :key="item.label" class="admin-card" style="margin: 0;">
            <p class="admin-card-title">{{ item.label }}</p>
            <div class="admin-card-value" style="font-size: 20px;">{{ item.value }}</div>
            <p v-if="item.sub" class="admin-card-sub">{{ item.sub }}</p>
          </div>
        </div>
      </div>

      <!-- GM 操作面板 -->
      <AdminPlayerActions
        :character-id="c.id"
        :is-banned="c.userStatus === 0"
        @done="reload"
      />

      <!-- 月卡订阅 -->
      <div class="admin-card">
        <h3 style="margin: 0 0 12px;">月卡 / 订阅</h3>
        <div class="admin-grid">
          <div v-for="sub in subscriptionList" :key="sub.label" class="admin-card" style="margin: 0;">
            <div class="admin-row between">
              <p class="admin-card-title" style="margin: 0;">{{ sub.label }}</p>
              <span class="admin-tag" :class="sub.active ? 'success' : ''">{{ sub.active ? '在效' : '未开通' }}</span>
            </div>
            <div class="admin-card-value" style="font-size: 18px; margin-top: 6px;">{{ sub.value }}</div>
            <p v-if="sub.expire" class="admin-card-sub">到期：{{ fmtDate(sub.expire) }}</p>
          </div>
        </div>
      </div>

      <!-- 装备 -->
      <div class="admin-card">
        <h3 style="margin: 0 0 12px;">装备背包（{{ data.equipment.length }}）</h3>
        <div v-if="data.equipment.length === 0" class="admin-empty">暂无装备</div>
        <div v-else class="admin-table-wrap" style="max-height: 360px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>槽位</th>
                <th>品质</th>
                <th>主属性</th>
                <th class="num">主值</th>
                <th class="num">强化</th>
                <th>套装</th>
                <th>锁</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="eq in data.equipment" :key="eq.id">
                <td><span :class="`rarity-${eq.rarity}`">{{ eq.name }}</span></td>
                <td>{{ eq.slot ? `已穿戴(${slotName(eq.slot)})` : '背包' }}</td>
                <td><span :class="`rarity-${eq.rarity}`">{{ rarityName(eq.rarity) }}</span></td>
                <td class="text-dim">{{ statName(eq.primary_stat) }}</td>
                <td class="num">{{ eq.primary_value }}</td>
                <td class="num">+{{ eq.enhance_level }}</td>
                <td class="text-dim">{{ eq.set_id || '-' }}</td>
                <td>{{ eq.locked ? '🔒' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 功法 -->
      <div class="admin-card">
        <h3 style="margin: 0 0 12px;">功法（背包 {{ data.skillInventory.length }} / 已装备 {{ data.equippedSkills.length }}）</h3>
        <h4 class="text-dim admin-mb-sm">已装备</h4>
        <div class="admin-row wrap admin-gap-sm admin-mb">
          <span v-for="s in data.equippedSkills" :key="s.skill_id + s.slot_index" class="admin-tag info">
            {{ skillTypeName(s.skill_type) }} #{{ s.slot_index + 1 }}: {{ s.skill_id }} Lv.{{ s.level }}
          </span>
          <span v-if="data.equippedSkills.length === 0" class="text-muted">无</span>
        </div>
        <h4 class="text-dim admin-mb-sm">背包</h4>
        <div v-if="data.skillInventory.length === 0" class="text-muted">无</div>
        <div v-else class="admin-row wrap admin-gap-sm">
          <span v-for="s in data.skillInventory" :key="s.skill_id" class="admin-tag">
            {{ s.skill_id }} · Lv.{{ s.level }} ×{{ s.count }}
          </span>
        </div>
      </div>

      <!-- 最近订单 -->
      <div class="admin-card">
        <h3 style="margin: 0 0 12px;">最近充值订单</h3>
        <div v-if="data.recentOrders.length === 0" class="admin-empty">暂无订单</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>商品</th>
                <th class="num">金额</th>
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in data.recentOrders" :key="o.id">
                <td class="text-dim">{{ o.order_no }}</td>
                <td>{{ o.package_name }}</td>
                <td class="num">¥{{ Number(o.price_rmb).toFixed(2) }}</td>
                <td><span class="admin-tag" :class="orderStatusClass(o.status)">{{ orderStatusName(o.status) }}</span></td>
                <td class="text-dim">{{ fmtDate(o.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const route = useRoute()
const api = useAdminApi()
const loading = ref(true)
const data = ref<any>(null)
const now = new Date()

const c = computed<any>(() => data.value?.character || {})
const subs = computed<any>(() => data.value?.subscriptions || {})

const baseStats = computed(() => {
  if (!data.value) return []
  return [
    { label: '境界', value: realmName(c.value.realmTier, c.value.realmStage) },
    { label: '等级', value: `Lv.${c.value.level}`, sub: `经验 ${Number(c.value.levelExp).toLocaleString()}` },
    { label: '灵根', value: rootName(c.value.spiritualRoot) },
    { label: '灵石', value: Number(c.value.spiritStone).toLocaleString() },
    { label: '血量', value: `${c.value.hp} / ${c.value.maxHp}` },
    { label: '攻击', value: c.value.atk },
    { label: '防御', value: c.value.def },
    { label: '身法', value: c.value.spd },
    { label: '暴击率', value: `${(Number(c.value.critRate) * 100).toFixed(2)}%` },
    { label: '暴击伤害', value: `${(Number(c.value.critDmg) * 100).toFixed(0)}%` },
    { label: '最近活跃', value: fmtDate(c.value.lastActiveAt) },
    { label: '创建时间', value: fmtDate(c.value.createdAt) },
  ] as Array<{ label: string; value: any; sub?: string }>
})

function isActive(expire: string | null, condition: boolean) {
  if (!condition) return false
  if (!expire) return true
  return new Date(expire) > now
}

const subscriptionList = computed(() => {
  if (!data.value) return []
  const s = subs.value
  return [
    { label: '洞府倍率', value: `${s.caveOutputMul}x`, expire: s.sponsorExpireAt, active: isActive(s.sponsorExpireAt, Number(s.caveOutputMul) > 1.0) },
    { label: '一键种植', value: s.oneclickPlant ? '启用' : '关闭', expire: s.oneclickPlantExpireAt, active: isActive(s.oneclickPlantExpireAt, !!s.oneclickPlant) },
    { label: '灵田扩容', value: `+${s.bonusPlotCount} 块`, expire: s.bonusPlotExpireAt, active: isActive(s.bonusPlotExpireAt, s.bonusPlotCount > 0) },
    { label: '秘境次数', value: `+${s.srDailyBonus} / 天`, expire: s.srBonusExpireAt, active: isActive(s.srBonusExpireAt, s.srDailyBonus > 0) },
    { label: '道侣游历', value: `+${s.expeditionDailyBonus} / 天`, expire: s.expeditionBonusExpireAt, active: isActive(s.expeditionBonusExpireAt, s.expeditionDailyBonus > 0) },
  ]
})

const REALM_NAMES = ['', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '飞升']
const ROOT_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
const RARITY_NAMES: Record<string, string> = { white: '白', green: '绿', blue: '蓝', purple: '紫', gold: '金', red: '红' }
// 装备 stat 字段：V4 大写（ATK / CRIT_DMG）与 V5 小写（atk / crit_dmg）共存，查询时统一小写匹配
const STAT_NAMES: Record<string, string> = {
  // 基础
  atk: '攻击', def: '防御', hp: '气血', max_hp: '最大气血', spd: '身法', spirit: '神识',
  // 百分比加成
  atk_pct: '攻击%', def_pct: '防御%', hp_pct: '气血%', spirit_pct: '神识%',
  hp_pct_or_def_pct: '气血%/防御%',
  // 会心
  crit_rate: '会心率', crit_dmg: '会心伤害',
  // 二级
  dodge: '闪避', lifesteal: '吸血', accuracy: '命中', armor_pen: '破甲',
  // 五行（V4 单系 + V5 综合）
  metal_dmg: '金强化', wood_dmg: '木强化', water_dmg: '水强化', fire_dmg: '火强化', earth_dmg: '土强化',
  wuxing_dmg: '五行强化',
  // 资源 / DOT / 反伤
  spirit_density: '灵气浓度', luck: '福缘',
  dot_dmg: 'DOT伤害', dot_dmg_pct: 'DOT伤害',
  reflect: '反伤', reflect_pct: '反伤倍率',
  res_pct: '五行抗性%',
  regen: '回血', shield: '护盾',
}
const SLOT_NAMES: Record<string, string> = {
  weapon: '武器', armor: '法袍', helmet: '法冠', boots: '步云靴',
  treasure: '法宝', ring: '灵戒', pendant: '灵佩',
}
const SKILL_TYPE_NAMES: Record<string, string> = { active: '主修', divine: '神通', passive: '被动' }

function realmName(tier: number, stage: number) { return `${REALM_NAMES[tier] || '?'} ${stage}层` }
function rootName(r: string) { return ROOT_NAMES[r] || r }
function rarityName(r: string) { return RARITY_NAMES[r] || r }
function statName(s: string) {
  if (!s) return s
  return STAT_NAMES[s] || STAT_NAMES[s.toLowerCase()] || s
}
function slotName(s: string) {
  if (!s) return s
  return SLOT_NAMES[s] || SLOT_NAMES[s.toLowerCase()] || s
}
function skillTypeName(t: string) { return SKILL_TYPE_NAMES[t] || t }

function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function orderStatusName(s: string) {
  return { pending: '待支付', paid: '已支付', delivered: '已发货', refunded: '已退款', cancelled: '已取消' }[s] || s
}
function orderStatusClass(s: string) {
  return { pending: 'warning', paid: 'info', delivered: 'success', refunded: 'danger', cancelled: '' }[s] || ''
}

async function reload() {
  try {
    const res = await api<any>(`/admin/players/${route.params.id}`)
    if (res.code === 200) data.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(reload)
</script>
