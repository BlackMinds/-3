<template>
  <div class="cd-overlay" @click.self="$emit('close')">
    <div class="cd-modal" v-if="detail">
      <div class="cd-header">
        <span class="cd-title">{{ detail.name }} · {{ detail.aptitudeName }}</span>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="cd-body">
        <div class="hero">
          <img class="hero-avatar" :src="childAvatarDataUrl(detail.gender, detail.aptitude)" :alt="detail.name" />
          <div class="hero-meta">
            <span class="aptitude-tag">{{ detail.aptitudeName }}</span>
            <span :class="['gender-tag', detail.gender]">{{ detail.gender === 'male' ? '♂ 男' : '♀ 女' }}</span>
            <span v-if="detail.awakened" class="awakened-tag">✦ 血脉觉醒</span>
            <span v-if="detail.isBattling" class="battling-tag">⚔ 助战中</span>
          </div>
        </div>

        <div class="section">
          <div class="row"><span class="lbl">阶段</span><span class="val">{{ detail.stageName }} · Lv.{{ detail.level }}</span></div>
          <div class="row"><span class="lbl">灵根</span><span class="val">{{ rootName(detail.spiritualRoot) }}灵根</span></div>
          <div class="row"><span class="lbl">气血</span><span class="val">{{ detail.maxHp }}</span></div>
          <div class="row"><span class="lbl">攻击</span><span class="val">{{ detail.atk }}</span></div>
          <div class="row"><span class="lbl">防御</span><span class="val">{{ detail.def }}</span></div>
          <div class="row"><span class="lbl">身法</span><span class="val">{{ detail.spd }}</span></div>
          <div class="row"><span class="lbl">会心率</span><span class="val">{{ pct(detail.critRate) }}</span></div>
          <div class="row"><span class="lbl">会心伤害</span><span class="val">{{ pct(detail.critDmg) }}</span></div>
          <div class="row"><span class="lbl">闪避</span><span class="val">{{ pct(detail.dodge) }}</span></div>
          <div class="row"><span class="lbl">吸血</span><span class="val">{{ pct(detail.lifesteal) }}</span></div>
          <div class="row"><span class="lbl">神识</span><span class="val">{{ detail.spirit }}</span></div>
          <div class="row"><span class="lbl">控制抗性</span><span class="val">{{ pct(detail.resistCtrl) }}</span></div>
          <div class="row">
            <span class="lbl">经验</span>
            <span class="val">{{ detail.levelExp }} / {{ detail.nextLevelExp }}</span>
          </div>
        </div>

        <div class="section" v-if="detail.skills && detail.skills.length">
          <div class="section-head">血脉功法</div>
          <div v-for="s in detail.skills" :key="s.id" class="skill-line">
            <span :class="['skill-name', `rarity-${s.rarity}`]">{{ s.name }}</span>
            <span class="skill-desc">{{ s.description }}</span>
          </div>
        </div>

        <div class="section" v-if="detail.talents && detail.talents.length">
          <div class="section-head">已觉醒天赋</div>
          <div v-for="t in detail.talents" :key="t.id" class="talent-line">
            <span :class="['talent-name', `rarity-${t.rarity}`]">{{ t.name }}</span>
            <span class="talent-desc">{{ t.description }}</span>
          </div>
        </div>

        <!-- 装备 -->
        <div v-if="!detail.hasLeftHome" class="section">
          <div class="section-head">装备</div>
          <div class="equip-slots">
            <div v-for="slot in SLOT_LIST" :key="slot.id" class="equip-slot">
              <div class="es-name">{{ slot.label }}</div>
              <div v-if="equippedBySlot[slot.id]" class="es-item">
                <span :class="['es-rarity', `rar-${equippedBySlot[slot.id].rarity}`]">{{ equippedBySlot[slot.id].name }}</span>
                <span class="es-pri">{{ statLabel(equippedBySlot[slot.id].primaryStat.stat) }} +{{ equippedBySlot[slot.id].primaryStat.value }}</span>
                <button class="btn-mini" @click="unequipItem(equippedBySlot[slot.id].id)">卸</button>
              </div>
              <div v-else class="es-empty">未装备</div>
            </div>
          </div>
          <div v-if="bagEquips.length > 0" class="equip-bag">
            <div class="section-head" style="margin-top:8px">装备背包</div>
            <div v-for="e in bagEquips" :key="e.id" class="bag-row" :class="`rar-${e.rarity}`">
              <span class="br-slot">[{{ e.slotName }}]</span>
              <span class="br-name">{{ e.name }}</span>
              <span class="br-pri">{{ statLabel(e.primaryStat.stat) }} +{{ e.primaryStat.value }}</span>
              <span v-if="e.subStats && e.subStats.length" class="br-sub">+{{ e.subStats.length }}副</span>
              <button class="btn-mini" @click="equipItem(e.id)">穿戴</button>
              <button class="btn-mini btn-sell" @click="sellItem(e.id, e.name)">出售</button>
            </div>
          </div>
          <div v-else class="equip-tip">无背包装备，可去「红尘玉商店」购买子女宝箱</div>
        </div>

        <!-- 离家标记 -->
        <div v-if="detail.hasLeftHome" class="section leave-banner">
          <div class="leave-title">🌿 外出历练中</div>
          <div class="leave-body">
            上次回家：{{ formatVisitDate(detail.lastVisitAt) }}<br />
            累计永久属性加成：<b>+{{ permanentBuffPct }}%</b>（每 10 天回家 +0.5%，上限 +20%）
          </div>
        </div>

        <div class="section actions">
          <button class="btn-action" :disabled="!canFeed" @click="openFeedPanel">
            🍃 喂养（{{ detail.feedCountToday }}/{{ detail.feedDailyMax }}）
          </button>
          <button v-if="canBattle" :class="['btn-action', detail.isBattling ? 'btn-cancel' : 'btn-action']" @click="onToggleBattling">
            {{ detail.isBattling ? '取消助战' : '⚔ 设为助战' }}
          </button>
          <button v-if="canReroll" class="btn-action btn-reroll" :disabled="store.acting" @click="onReroll">
            🔮 资质重铸（消耗 夺天造化丹 ×1）
          </button>
        </div>

        <!-- 资质重铸结果展示 -->
        <div v-if="rerollResult" class="section reroll-result">
          <div class="rr-title">{{ rerollResult.kept ? '保底保留原资质' : '重铸成功' }}</div>
          <div class="rr-row">资质：{{ aptName(rerollResult.oldAptitude) }} → <b>{{ aptName(rerollResult.finalAptitude) }}</b></div>
          <div class="rr-row">本次滚到：{{ aptName(rerollResult.rolledAptitude) }}</div>
          <div class="rr-row">新血脉功法：<b>{{ rerollResult.newSkillName }}</b></div>
          <button class="btn-secondary" @click="rerollResult = null">关闭</button>
        </div>

        <!-- 成年选择弹窗 -->
        <div v-if="showComeOfAge" class="confirm-overlay" @click.self="() => {}">
          <div class="coa-modal">
            <div class="coa-title">🎉 {{ detail.name }} 已成年</div>
            <div class="coa-body">
              <p>「父母大人，孩儿已成年，欲……」</p>
              <button class="coa-choice" :disabled="store.acting" @click="onComeOfAge('stay')">
                <b>A. 留在家中助战</b>
                <span class="coa-desc">继续作为助战单位，按 youth/adult 阶段加成</span>
              </button>
              <button class="coa-choice" :disabled="store.acting" @click="onComeOfAge('leave')">
                <b>B. 外出历练</b>
                <span class="coa-desc">每 10 天回家 +0.5% 永久属性（上限 +20%），不再助战</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 资质重铸消耗确认 -->
        <div v-if="rerollConfirm" class="confirm-overlay" @click.self="rerollConfirm = false">
          <div class="confirm-modal">
            <div class="confirm-title">🔮 资质重铸</div>
            <div class="confirm-body">
              消耗 <b>夺天造化丹 ×1</b>，重新随机资质。<br /><br />
              当前资质：<b>{{ detail.aptitudeName }}</b><br />
              <span style="color: #aaa; font-size: 12px">新资质若低于原资质，按保底保留旧资质（但血脉功法仍会重生）。</span>
            </div>
            <div class="confirm-actions">
              <button class="btn-secondary" @click="rerollConfirm = false">取消</button>
              <button class="btn-danger" :disabled="store.acting" @click="confirmReroll">确认重铸</button>
            </div>
          </div>
        </div>

        <div v-if="feedPanelOpen" class="feed-panel">
          <div class="feed-head">选择灵草喂养（背包中可用）</div>
          <div v-if="feedOptions.length === 0" class="empty-hint">背包没有灵草。游历或炼丹可获得。</div>
          <div v-else class="feed-list">
            <button
              v-for="o in feedOptions"
              :key="o.id"
              class="feed-row"
              :disabled="store.acting"
              @click="onFeed(o)"
            >
              <span class="feed-herb">{{ o.name }}·{{ qualityName(o.quality) }}</span>
              <span class="feed-stock">×{{ o.count }}</span>
              <span class="feed-exp">+{{ o.exp }} 经验</span>
            </button>
          </div>
          <button class="btn-secondary" @click="feedPanelOpen = false">关闭</button>
        </div>

        <div v-if="toast" class="toast">{{ toast }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCompanionStore } from '~/stores/companion'
import { childAvatarDataUrl } from '~/game/companionAvatar'

const props = defineProps<{ childId: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useCompanionStore()
const detail = ref<any>(null)
const feedPanelOpen = ref(false)
const feedOptions = ref<any[]>([])
const toast = ref('')

const ROOT_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土', mixed: '混' }
function rootName(r: string): string { return ROOT_NAMES[r] || r }

const QUALITY_LABEL: Record<string, string> = { white: '凡品', green: '灵品', blue: '玄品', purple: '地品', gold: '天品', red: '仙品' }
function qualityName(q: string): string { return QUALITY_LABEL[q] || q }
const QUALITY_EXP: Record<string, number> = { white: 50, green: 200, blue: 500, purple: 2000, gold: 10000, red: 30000 }

const HERB_NAMES: Record<string, string> = {
  common_herb: '灵草', metal_herb: '锐金草', wood_herb: '青木叶',
  water_herb: '玄水苔', fire_herb: '赤焰花', earth_herb: '厚土参',
  spirit_grass: '仙灵草',
}

// 等级上限按资质（凡 50 / 下 80 / 中 100 / 上 130 / 极 160 / 仙 200 / 圣 999）
const APTITUDE_LEVEL_CAP = [50, 80, 100, 130, 160, 200, 999]
const childLevelCap = computed(() => APTITUDE_LEVEL_CAP[detail.value?.aptitude || 0] || 100)
const canFeed = computed(() => detail.value && detail.value.feedCountToday < detail.value.feedDailyMax && detail.value.level < childLevelCap.value && !detail.value.hasLeftHome)
// 成年弹窗按"已达资质上限"判定（凡品 lv50 = 成年）
const isAdult = computed(() => detail.value && detail.value.level >= childLevelCap.value)
const canBattle = computed(() => detail.value && detail.value.level >= 31 && !detail.value.hasLeftHome && !isAdult.value)
const canReroll = computed(() => detail.value && !detail.value.hasLeftHome)

const APTITUDE_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品', '圣品']
function aptName(a: number): string { return APTITUDE_NAMES[a] || '?' }

const permanentBuffPct = computed(() => {
  const p = Number(detail.value?.permanentBuffPct || 0)
  return (p * 100).toFixed(1)
})
function formatVisitDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 成年弹窗（level=100 + 未离家 + 未做过选择 = 自动弹）
const comeOfAgeDismissed = ref(false)
const showComeOfAge = computed(() =>
  detail.value &&
  detail.value.level >= childLevelCap.value &&
  !detail.value.hasLeftHome &&
  !comeOfAgeDismissed.value
)

async function onComeOfAge(choice: 'stay' | 'leave') {
  if (!detail.value) return
  const res = await store.comeOfAgeChild(detail.value.id, choice)
  showToast(res.message || (res.ok ? (choice === 'stay' ? '留家成功' : '已外出历练') : '操作失败'))
  if (res.ok) {
    comeOfAgeDismissed.value = true
    detail.value = await store.loadChildDetail(props.childId)
  }
}

// 资质重铸
const rerollConfirm = ref(false)
const rerollResult = ref<any | null>(null)
function onReroll() { rerollConfirm.value = true }
async function confirmReroll() {
  if (!detail.value) return
  const res = await store.rerollChildAptitude(detail.value.id)
  rerollConfirm.value = false
  if (res.ok && res.data) {
    rerollResult.value = res.data
    detail.value = await store.loadChildDetail(props.childId)
  } else {
    showToast(res.message || '重铸失败')
  }
}

async function openFeedPanel() {
  feedPanelOpen.value = true
  // 拉取背包中的可喂养灵草
  const api = useApi()
  // 简化：直接 SQL 风格查 character_materials（仅灵草）
  // 这里走前端 fetch，复用现有的 inventory API（如果有）；MVP 阶段直接列出常见灵草并显示库存
  // 后端可加专门 API；当前用前端硬编码主灵草 ID + qualities
  const HERB_IDS = ['common_herb', 'metal_herb', 'wood_herb', 'water_herb', 'fire_herb', 'earth_herb', 'spirit_grass']
  const QUALS = ['white', 'green', 'blue', 'purple', 'gold', 'red']
  const opts: any[] = []
  // 拉个 RPC 查一次（这里复用 child/feed 的检查，简化前端只列出）
  // 临时方案：只展示固定列表，不显示库存
  for (const hId of HERB_IDS) {
    for (const q of QUALS) {
      opts.push({
        id: hId,
        name: HERB_NAMES[hId] || hId,
        quality: q,
        count: '?',  // 真实库存由后端校验
        exp: QUALITY_EXP[q] || 50,
      })
    }
  }
  feedOptions.value = opts.slice(0, 14)  // 仅显示前 14 项（凡-玄品）避免列表过长
}

async function onFeed(o: any) {
  const res = await store.feedChild(props.childId, o.id, o.quality)
  showToast(res.message || (res.ok ? '喂养成功' : '喂养失败'))
  if (res.ok) {
    detail.value = await store.loadChildDetail(props.childId)
  }
}

// ===== 子女装备 =====
const SLOT_LIST = [
  { id: 'weapon', label: '武器' },
  { id: 'robe', label: '法袍' },
  { id: 'amulet1', label: '饰品1' },
  { id: 'amulet2', label: '饰品2' },
]
const equipList = ref<any[]>([])

async function loadEquipments() {
  if (!detail.value) return
  const api = useApi()
  const res = await api<{ code: number; data?: { equipments: any[] } }>('/child/equipment', {
    query: { child_id: detail.value.id }
  })
  if (res.code === 200) equipList.value = res.data?.equipments || []
}

const equippedBySlot = computed(() => {
  const map: Record<string, any> = {}
  for (const e of equipList.value) if (e.isEquipped) map[e.slot] = e
  return map
})
const bagEquips = computed(() => equipList.value.filter(e => !e.isEquipped))

function pct(v: any): string {
  const n = Number(v || 0)
  return (n * 100).toFixed(1) + '%'
}

function statLabel(s: string): string {
  return ({ atk: '攻击', def: '防御', max_hp: '气血', spd: '身法', crit_rate: '会心率', crit_dmg: '会心伤害' } as any)[s] || s
}

async function equipItem(id: number) {
  const api = useApi()
  const r = await api<{ code: number; message?: string }>('/child/equip', { method: 'POST', body: { equipment_id: id } })
  showToast(r.message || (r.code === 200 ? '穿戴成功' : '穿戴失败'))
  if (r.code === 200) await loadEquipments()
}
async function unequipItem(id: number) {
  const api = useApi()
  const r = await api<{ code: number; message?: string }>('/child/unequip', { method: 'POST', body: { equipment_id: id } })
  showToast(r.message || (r.code === 200 ? '已卸下' : '卸下失败'))
  if (r.code === 200) await loadEquipments()
}
async function sellItem(id: number, name: string) {
  if (!confirm(`确定出售「${name}」？此操作不可撤销。`)) return
  const api = useApi()
  const r = await api<{ code: number; message?: string }>('/child/sell-equipment', { method: 'POST', body: { equipment_id: id } })
  showToast(r.message || (r.code === 200 ? '已出售' : '出售失败'))
  if (r.code === 200) await loadEquipments()
}

async function onToggleBattling() {
  const targetId = detail.value.isBattling ? null : detail.value.id
  const res = await store.setBattlingChild(targetId)
  showToast(res.message || (res.ok ? '已切换' : '切换失败'))
  if (res.ok) {
    detail.value = await store.loadChildDetail(props.childId)
  }
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2000)
}

onMounted(async () => {
  detail.value = await store.loadChildDetail(props.childId)
  if (detail.value) await loadEquipments()
})
</script>

<style scoped>
.cd-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1500;
}
.cd-modal {
  background: linear-gradient(180deg, #1a1027, #2a1a3a);
  border: 1px solid #b070ff; border-radius: 10px;
  width: 92vw; max-width: 540px; max-height: 86vh;
  display: flex; flex-direction: column;
}
.cd-header {
  padding: 12px 16px; background: rgba(80,40,100,0.5);
  border-bottom: 1px solid #5a3a7a;
  display: flex; align-items: center; justify-content: space-between;
}
.cd-title { color: #ffd700; font-size: 16px; font-weight: bold; }
.close-btn { background: transparent; border: none; color: #ddd; font-size: 22px; cursor: pointer; }

.cd-body { flex: 1; overflow-y: auto; padding: 14px 18px; }

.hero { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
.hero-avatar { width: 80px; height: 80px; border-radius: 50%; }
.hero-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.aptitude-tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: bold; background: rgba(255,215,0,0.25); color: #ffd700; }
.gender-tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: bold; }
.gender-tag.male { background: rgba(74,158,255,0.25); color: #4a9eff; }
.gender-tag.female { background: rgba(255,126,179,0.25); color: #ff7eb3; }
.awakened-tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; background: rgba(255,140,186,0.25); color: #ff8cba; font-weight: bold; }
.battling-tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; background: rgba(255,215,0,0.2); color: #ffd700; }

.section {
  margin-bottom: 12px; padding: 10px 12px;
  background: rgba(40,20,60,0.4); border-radius: 6px;
  border: 1px solid #3a2050;
}
.section-head {
  color: #c8a8ff; font-size: 12px; margin-bottom: 8px;
  border-left: 2px solid #b070ff; padding-left: 6px;
}
.row { display: flex; gap: 8px; padding: 3px 0; font-size: 13px; }
.lbl { color: #aaa; min-width: 60px; }
.val { color: #fff; }

.skill-line, .talent-line {
  display: flex; flex-direction: column; gap: 2px;
  padding: 4px 0; font-size: 13px;
}
.skill-name, .talent-name { font-weight: bold; }
.rarity-common { color: #cfcfcf; }
.rarity-uncommon, .rarity-green { color: #5fcf6f; }
.rarity-rare, .rarity-blue { color: #5fa0e8; }
.rarity-epic, .rarity-purple { color: #c87aff; }
.rarity-legendary, .rarity-gold { color: #ffd366; }
.rarity-red { color: #ff8888; }
.skill-desc, .talent-desc { color: #aaa; font-size: 11px; }

.actions { display: flex; gap: 10px; }
.btn-action {
  flex: 1; background: rgba(80,40,100,0.6); color: #fff;
  border: 1px solid #6a4a8a; padding: 8px 12px;
  border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-action:hover:not(:disabled) { background: rgba(120,60,150,0.7); }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-action.btn-cancel { border-color: #d4514c; color: #ff8c8c; }
.btn-action.btn-reroll { border-color: #b070ff; color: #d4b0ff; }
.btn-action.btn-reroll:hover:not(:disabled) { background: rgba(176,112,255,0.3); }

/* 装备区 */
.equip-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.equip-slot { padding: 6px 10px; background: rgba(40,20,60,0.6); border: 1px solid #3a2050; border-radius: 4px; font-size: 12px; }
.es-name { color: #c8a8ff; margin-bottom: 3px; }
.es-item { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.es-rarity { font-weight: bold; flex: 1; }
.es-rarity.rar-white { color: #ddd; }
.es-rarity.rar-green { color: #5fcf6f; }
.es-rarity.rar-blue { color: #5fa0e8; }
.es-rarity.rar-purple { color: #c87aff; }
.es-rarity.rar-gold { color: #ffd366; }
.es-rarity.rar-red { color: #ff8888; }
.es-pri { color: #ffd700; font-size: 11px; }
.es-empty { color: #555; font-style: italic; }

.equip-bag { margin-top: 8px; }
.bag-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 11px; margin-bottom: 4px; flex-wrap: wrap; }
.bag-row.rar-white { border-left: 2px solid #ddd; }
.bag-row.rar-green { border-left: 2px solid #5fcf6f; }
.bag-row.rar-blue { border-left: 2px solid #5fa0e8; }
.bag-row.rar-purple { border-left: 2px solid #c87aff; }
.bag-row.rar-gold { border-left: 2px solid #ffd366; }
.bag-row.rar-red { border-left: 2px solid #ff8888; }
.br-slot { color: #aaa; }
.br-name { color: #fff; flex: 1; }
.br-pri { color: #ffd700; }
.br-sub { color: #c8a8ff; }
.btn-mini { background: #555; color: #fff; border: none; padding: 2px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; }
.btn-mini:hover { background: #777; }
.btn-mini.btn-sell { background: #774a2a; }
.btn-mini.btn-sell:hover { background: #946238; }
.equip-tip { color: #888; font-size: 11px; padding: 8px; text-align: center; font-style: italic; }

/* 离家 banner */
.leave-banner {
  background: rgba(95,207,111,0.12);
  border: 1px solid #5fcf6f;
}
.leave-title { color: #5fcf6f; font-weight: bold; font-size: 13px; margin-bottom: 6px; }
.leave-body { color: #d8c4f0; font-size: 12px; line-height: 1.6; }
.leave-body b { color: #ffd700; }

/* 重铸结果 */
.reroll-result {
  background: rgba(176,112,255,0.15);
  border: 1px solid #b070ff;
}
.rr-title { color: #d4b0ff; font-weight: bold; font-size: 13px; margin-bottom: 6px; }
.rr-row { font-size: 12px; color: #ddd; padding: 2px 0; }
.rr-row b { color: #ffd700; }

/* 成年弹窗 */
.confirm-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 20;
}
.coa-modal {
  background: linear-gradient(180deg, #2a1a3a, #1a1027);
  border: 1px solid #ffd700; border-radius: 12px;
  padding: 22px; width: 92%; max-width: 380px;
  box-shadow: 0 4px 28px rgba(255,215,0,0.35);
}
.coa-title {
  color: #ffd700; font-size: 16px; font-weight: bold;
  text-align: center; margin-bottom: 16px;
}
.coa-body p { color: #d8c4f0; font-size: 13px; text-align: center; margin-bottom: 12px; }
.coa-choice {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  width: 100%; padding: 12px; margin-bottom: 8px;
  background: rgba(80,40,100,0.6); border: 1px solid #b070ff;
  border-radius: 6px; cursor: pointer;
}
.coa-choice:hover:not(:disabled) { background: rgba(120,60,150,0.7); }
.coa-choice b { color: #ffd700; font-size: 14px; }
.coa-desc { color: #aaa; font-size: 11px; }

/* 资质重铸消耗确认 */
.confirm-modal {
  background: #1f1429; border: 1px solid #b070ff;
  border-radius: 10px; padding: 22px;
  width: 92%; max-width: 380px;
}
.confirm-title {
  color: #d4b0ff; font-size: 16px; font-weight: bold;
  text-align: center; margin-bottom: 12px;
}
.confirm-body {
  color: #d8c4f0; font-size: 13px; line-height: 1.7;
  padding: 8px; background: rgba(40,20,60,0.4); border-radius: 6px;
}
.confirm-body b { color: #ffd700; }
.confirm-actions {
  display: flex; justify-content: space-between; gap: 12px;
  margin-top: 16px;
}
.confirm-actions button { flex: 1; padding: 10px; border-radius: 6px; font-size: 14px; cursor: pointer; border: 1px solid; }
.btn-danger {
  background: rgba(176,112,255,0.3); border-color: #b070ff; color: #fff;
}
.btn-danger:hover:not(:disabled) { background: rgba(176,112,255,0.5); }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.feed-panel {
  margin-top: 12px;
  padding: 10px;
  background: rgba(0,0,0,0.4);
  border-radius: 6px;
}
.feed-head { color: #c8a8ff; font-size: 12px; margin-bottom: 6px; }
.empty-hint { color: #888; padding: 12px; text-align: center; font-size: 12px; }
.feed-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
.feed-row {
  display: grid; grid-template-columns: 1fr auto auto;
  align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 4px;
  background: rgba(40,20,60,0.6); border: 1px solid #3a2050;
  color: #ddd; cursor: pointer; font-size: 12px; text-align: left;
}
.feed-row:hover:not(:disabled) { border-color: #b070ff; background: rgba(70,40,90,0.7); }
.feed-herb { color: #fff; }
.feed-stock { color: #aaa; }
.feed-exp { color: #ffd700; }
.btn-secondary {
  margin-top: 8px; width: 100%;
  background: #555; color: #fff; border: none;
  padding: 6px; border-radius: 4px; cursor: pointer;
  font-size: 12px;
}

.toast {
  position: fixed; bottom: 20%; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.85); color: #ffd700;
  padding: 10px 18px; border-radius: 6px;
  border: 1px solid #b070ff; font-size: 13px;
  z-index: 3000;
}
</style>
