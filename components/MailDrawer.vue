<template>
  <div v-if="modelValue" class="mail-overlay" @click.self="close">
    <div class="mail-drawer">
      <div class="mail-header">
        <h3>📬 我的邮箱</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="mail-tabs">
        <button
          v-for="t in tabs"
          :key="t.value || 'all'"
          :class="['tab', { active: activeCat === t.value }]"
          @click="switchCat(t.value)"
        >
          {{ t.icon }} {{ t.label }}
        </button>
      </div>

      <div class="mail-toolbar">
        <button class="btn primary" :disabled="loading || !unclaimed" @click="claimAll">
          🎁 一键领取 <span v-if="unclaimed">({{ unclaimed }})</span>
        </button>
        <button class="btn" :disabled="loading || !unread" @click="readAll">全部已读</button>
        <span class="count">共 {{ total }} · 未读 <b>{{ unread }}</b></span>
      </div>

      <div class="mail-list">
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!list.length" class="empty">
          <div class="empty-icon">📭</div>
          <div>暂无邮件</div>
        </div>
        <div
          v-for="m in list"
          :key="m.id"
          :class="['mail-item', { unread: !m.is_read, expanded: expandedId === m.id }]"
        >
          <div class="mail-row" @click="toggleExpand(m)">
            <div class="mail-icon-wrap">
              <span class="mail-icon">{{ catIcon(m.category) }}</span>
            </div>
            <div class="mail-main">
              <div class="mail-title">
                <span v-if="!m.is_read" class="dot" />
                {{ m.title }}
                <span v-if="!m.is_claimed && attachmentCount(m) > 0" class="badge">附件</span>
              </div>
              <div class="mail-preview">{{ m.content }}</div>
            </div>
            <div class="mail-side">
              <div class="mail-time">{{ formatTime(m.created_at) }}</div>
              <button
                v-if="!m.is_claimed && attachmentCount(m) > 0"
                class="btn sm primary claim-btn"
                @click.stop="claim(m.id)"
              >领取</button>
            </div>
          </div>
          <div v-if="expandedId === m.id" class="mail-detail">
            <div class="mail-content-full">{{ m.content }}</div>
            <div v-if="attachmentCount(m) > 0" class="mail-attachments">
              <div class="att-title">附件详情</div>
              <div class="att-list">
                <div v-for="(att, idx) in m.attachments" :key="idx" class="att-row">
                  <span class="att-icon">{{ attIcon(att.type) }}</span>
                  <span class="att-label">{{ attLabel(att) }}</span>
                  <span v-if="m.is_claimed" class="att-claimed">已领取</span>
                </div>
              </div>
              <button v-if="!m.is_claimed" class="btn primary full" @click="claim(m.id)">领取所有附件</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const api = useApi()
const list = ref<any[]>([])
const total = ref(0)
const unread = ref(0)
const unclaimed = ref(0)
const loading = ref(false)
const activeCat = ref<string | null>(null)
const expandedId = ref<number | null>(null)

const tabs = [
  { value: null, label: '全部', icon: '📬' },
  { value: 'sect_war', label: '宗门战', icon: '⚔️' },
  { value: 'sect_war_bet', label: '押注', icon: '💰' },
  { value: 'spirit_vein_surge', label: '涌灵', icon: '🌊' },
  { value: 'spirit_vein_raid', label: '偷袭', icon: '🗡️' },
  { value: 'spirit_vein_jackpot', label: '奖池', icon: '🏆' },
]

function close() { emit('update:modelValue', false) }

function attachmentCount(m: any) {
  return Array.isArray(m.attachments) ? m.attachments.length : 0
}

function formatTime(t: string) {
  const d = new Date(t)
  const now = new Date()
  const diffHours = (now.getTime() - d.getTime()) / 3600000
  if (diffHours < 1) return `${Math.max(1, Math.floor(diffHours * 60))}分钟前`
  if (diffHours < 24) return `${Math.floor(diffHours)}小时前`
  if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}天前`
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function catIcon(c: string) {
  return { sect_war: '⚔️', sect_war_bet: '💰', spirit_vein_surge: '🌊', spirit_vein_raid: '🗡️', spirit_vein_jackpot: '🏆', system: '📢' }[c] || '📬'
}

function attIcon(type: string) {
  return {
    spirit_stone: '💎', contribution: '📜', exp: '✨',
    material: '🧪', recipe: '📖', title: '🏅', timed_buff: '🌟',
  }[type] || '🎁'
}

// 属性 key 中文映射
const STAT_LABEL: Record<string, string> = {
  atk_pct: '攻击', def_pct: '防御', hp_pct: '气血', spd_pct: '身法',
  crit_rate: '暴击率', crit_dmg: '暴击伤害',
  atk: '攻击', def: '防御', hp: '气血', spd: '身法',
  dodge: '闪避', lifesteal: '吸血',
  armor_pen: '破甲', accuracy: '命中',
}
const MATERIAL_LABEL: Record<string, string> = {
  awaken_stone: '觉醒石',
  spirit_inscription: '附灵石',
}
const QUALITY_LABEL: Record<string, string> = {
  white: '白', green: '绿', blue: '蓝', purple: '紫', gold: '金',
}
const RECIPE_LABEL: Record<string, string> = {
  // 初级
  basic_atk_pill: '基础攻击丹方',
  basic_def_pill: '基础防御丹方',
  basic_hp_pill: '基础气血丹方',
  basic_crit_pill: '基础会心丹方',
  // 中级
  atk_pill_1: '攻击丹方',
  def_pill_1: '防御丹方',
  hp_pill_1: '气血丹方',
  full_pill_1: '全属性丹方',
  // 高级
  elite_atk_pill: '精铁攻击丹方',
  elite_def_pill: '精铁防御丹方',
  elite_hp_pill: '精铁气血丹方',
  pill_advanced_gold_core: '金丹速成丹方',
}

function attLabel(att: any) {
  switch (att.type) {
    case 'spirit_stone': return `灵石 × ${att.amount.toLocaleString()}`
    case 'contribution': return `宗门贡献 × ${att.amount.toLocaleString()}`
    case 'exp': return `修为 × ${att.amount.toLocaleString()}`
    case 'material': {
      const name = MATERIAL_LABEL[att.itemId] || att.itemId
      const q = QUALITY_LABEL[att.quality || 'blue'] || att.quality || '蓝'
      return `${name} (${q}品) × ${att.qty}`
    }
    case 'recipe': return `丹方：${RECIPE_LABEL[att.recipeId] || att.recipeId}`
    case 'title': return `称号：${att.titleKey}（${Math.floor(att.duration / 86400)} 天）`
    case 'timed_buff': {
      const statName = STAT_LABEL[att.statKey] || att.statKey
      return `${statName} +${att.statValue}%（${Math.floor(att.duration / 86400)} 天）`
    }
    default: return JSON.stringify(att)
  }
}

async function load() {
  loading.value = true
  try {
    const q: any = { page: 1, pageSize: 40 }
    if (activeCat.value) q.category = activeCat.value
    const res = await api('/mail/list', { query: q })
    if (res.code === 200) {
      list.value = res.data.list
      total.value = res.data.total
    }
    const ur = await api('/mail/unread-count')
    if (ur.code === 200) {
      unread.value = ur.data.unread
      unclaimed.value = ur.data.unclaimed
    }
  } finally {
    loading.value = false
  }
}

async function switchCat(c: string | null) {
  activeCat.value = c
  expandedId.value = null
  await load()
}

async function toggleExpand(m: any) {
  if (expandedId.value === m.id) {
    expandedId.value = null
    return
  }
  expandedId.value = m.id
  if (!m.is_read) {
    await api('/mail/read', { method: 'POST', body: { id: m.id } })
    m.is_read = true
    unread.value = Math.max(0, unread.value - 1)
  }
}

async function claim(id: number) {
  try {
    const res = await api('/mail/claim', { method: 'POST', body: { id } })
    if (res.code === 200) {
      await load()
    } else {
      alert(res.message)
    }
  } catch {
    alert('领取失败')
  }
}

async function claimAll() {
  const res = await api('/mail/claim-all', { method: 'POST', body: {} })
  if (res.data?.claimed > 0) {
    // 简单提示
    console.log('[mail] claimed:', res.data.claimed, 'granted:', res.data.granted)
  }
  await load()
}

async function readAll() {
  await api('/mail/read', { method: 'POST', body: {} })
  await load()
}

watch(() => props.modelValue, (v) => { if (v) load() })
</script>

<style scoped>
.mail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 9000; display: flex; justify-content: flex-end;
}
.mail-drawer {
  width: 460px; max-width: 100vw; height: 100%;
  background: #1a1a2e; color: #e0e0f0;
  display: flex; flex-direction: column;
  border-left: 1px solid #333;
  animation: slideIn 0.2s ease-out;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.mail-header {
  padding: 16px 16px 10px; border-bottom: 1px solid #333;
  position: relative; display: flex; align-items: center; justify-content: space-between;
}
.mail-header h3 { margin: 0; font-size: 18px; color: #ffd700; }
.close-btn {
  background: none; border: none; color: #aab;
  font-size: 26px; cursor: pointer; line-height: 1;
  padding: 0 8px;
}
.close-btn:hover { color: #fff; }

.mail-tabs {
  display: flex; gap: 4px; padding: 0 16px 10px; border-bottom: 1px solid #333;
  overflow-x: auto;
  flex-wrap: wrap;
}
.mail-tabs .tab {
  background: #2a2a42; color: #aab; border: none; padding: 5px 10px;
  border-radius: 4px; font-size: 14px; cursor: pointer;
  white-space: nowrap; transition: all 0.15s;
}
.mail-tabs .tab:hover { background: #3a3a55; }
.mail-tabs .tab.active { background: #7a5ca8; color: #fff; }

.mail-toolbar {
  padding: 10px 16px; display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid #333; font-size: 14px;
}
.mail-toolbar .count { margin-left: auto; color: #888; }
.mail-toolbar .count b { color: #f44; }

.btn {
  background: #2a2a42; color: #ddd; border: 1px solid #444;
  padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;
  transition: all 0.15s;
}
.btn:hover:not(:disabled) { background: #3a3a55; border-color: #666; }
.btn.sm { padding: 3px 8px; font-size: 13px; }
.btn.primary { background: #7a5ca8; border-color: #a77bd6; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #8b6dbb; }
.btn.full { width: 100%; margin-top: 10px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.mail-list { flex: 1; overflow-y: auto; }
.empty { padding: 40px; text-align: center; color: #666; }
.empty-icon { font-size: 48px; opacity: 0.3; margin-bottom: 10px; }

.mail-item {
  border-bottom: 1px solid #2a2a42;
  transition: background 0.15s;
}
.mail-item:hover { background: #222238; }
.mail-item.expanded { background: #1f1f35; }

.mail-row {
  padding: 12px 16px;
  display: flex; gap: 10px; align-items: flex-start;
  cursor: pointer;
}
.mail-icon-wrap {
  width: 36px; height: 36px; border-radius: 50%;
  background: #2a2a42; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
.mail-icon { font-size: 18px; }
.mail-item.unread .mail-icon-wrap { background: linear-gradient(135deg, #7a5ca8, #4a3a68); box-shadow: 0 0 6px rgba(122, 92, 168, 0.5); }

.mail-main { flex: 1; min-width: 0; }
.mail-item.unread .mail-title { font-weight: bold; color: #fff; }
.mail-title {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 3px; font-size: 16px; color: #ddd;
}
.mail-title .dot { width: 6px; height: 6px; border-radius: 50%; background: #f44; }
.mail-title .badge { background: #d69e3c; color: #000; padding: 0 6px; border-radius: 3px; font-size: 12px; font-weight: normal; }
.mail-preview {
  color: #888; font-size: 14px; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}

.mail-side {
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  flex-shrink: 0;
}
.mail-time { color: #666; font-size: 13px; }

.mail-detail {
  padding: 12px 16px 16px 62px;
  background: #0e0e1a;
  border-top: 1px dashed #333;
  font-size: 15px;
}
.mail-content-full { color: #ccc; line-height: 1.6; margin-bottom: 12px; white-space: pre-wrap; }
.mail-attachments { background: #1a1a2e; padding: 10px 12px; border-radius: 4px; }
.att-title { color: #aab; font-size: 13px; margin-bottom: 6px; }
.att-list { display: flex; flex-direction: column; gap: 4px; }
.att-row { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 4px 0; }
.att-icon { font-size: 16px; width: 22px; text-align: center; }
.att-label { flex: 1; color: #eee; }
.att-claimed { color: #3a7; font-size: 12px; }

@media (max-width: 768px) {
  .mail-drawer { width: 100%; }
  .mail-header { padding: 10px 12px 8px; }
  .mail-header h3 { font-size: 15px; }
  .close-btn { font-size: 22px; }
  .mail-tabs { padding: 0 10px 8px; gap: 3px; flex-wrap: nowrap; }
  .mail-tabs .tab { font-size: 12px; padding: 4px 8px; }
  .mail-toolbar { padding: 8px 12px; font-size: 12px; gap: 6px; flex-wrap: wrap; }
  .mail-toolbar .btn { font-size: 12px; padding: 4px 8px; }
  .mail-row { padding: 10px 12px; gap: 8px; }
  .mail-icon-wrap { width: 30px; height: 30px; }
  .mail-icon { font-size: 15px; }
  .mail-title { font-size: 14px; }
  .mail-preview { font-size: 12px; }
  .mail-time { font-size: 11px; }
  .mail-detail { padding: 10px 12px 12px 48px; font-size: 13px; }
  .att-row { font-size: 12px; }
}
</style>
