<template>
  <div class="detail-overlay" @click.self="close">
    <div class="detail-modal" v-if="detail">
      <div class="detail-header">
        <span class="detail-title">{{ detail.name }} · {{ detail.qualityName }}</span>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="detail-body">
        <div class="hero">
          <img class="hero-avatar" :src="avatarUrl" :alt="detail.name" />
          <div class="hero-meta">
            <span :class="['quality-tag', `quality-${detail.qualityColor}`]">{{ detail.qualityName }}</span>
            <span v-if="detail.isOfficial" class="official-tag">✨ 正式道侣</span>
          </div>
        </div>

        <div class="detail-section">
          <div class="row">
            <span class="label">灵根</span>
            <span :class="['root-tag', `root-${detail.spiritualRoot}`]">{{ detail.rootName }}灵根</span>
          </div>
          <div class="row">
            <span class="label">性格</span>
            <span class="info-tag">{{ detail.personality }}</span>
          </div>
          <div class="row">
            <span class="label">阶段</span>
            <span class="stage-tag">{{ detail.stage }}</span>
          </div>
          <div class="row">
            <span class="label">亲密度</span>
            <span class="intimacy-text">{{ detail.intimacy }} / {{ detail.isOfficial ? 9999 : 600 }}</span>
          </div>
          <div v-if="detail.isOfficial" class="row">
            <span class="label">仙缘印记</span>
            <span class="info-tag tag-gold">LV {{ detail.sealLevel }} (全属性 +{{ sealStat }}%)</span>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-head">喜好倾向</div>
          <div class="prefs">
            <div v-if="detail.preferredGifts.length">
              <span class="prefs-label">喜爱：</span>
              <span v-for="g in detail.preferredGifts" :key="g" class="gift-tag">{{ itemName(g) }}</span>
            </div>
            <div v-if="detail.dislikedGifts.length">
              <span class="prefs-label">厌恶：</span>
              <span v-for="g in detail.dislikedGifts" :key="g" class="gift-tag tag-bad">{{ itemName(g) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-head">已解锁阶段</div>
          <div class="stages">
            <span
              v-for="s in detail.unlockedStages"
              :key="s.threshold"
              :class="['stage-pill', { unlocked: s.unlocked }]"
              :title="s.description"
            >
              {{ s.unlocked ? '✓' : '◯' }} {{ s.name }}
            </span>
          </div>
        </div>

        <div class="detail-section" v-if="canMarry">
          <button class="btn-primary" :disabled="store.acting" @click="onMarry">
            ✨ 与之结为道侣
          </button>
        </div>

        <div class="detail-section actions">
          <button v-if="canGift" class="btn-action" @click="openGift">🎁 赠送礼物</button>
          <button v-if="canDate" class="btn-action btn-date" @click="openDate">💕 约会</button>
          <button v-if="canUpgradeSeal" class="btn-action btn-seal" @click="onUpgradeSeal">⬆ 升级仙缘印记</button>
          <button v-if="canConceive" class="btn-action btn-conceive" @click="onConceive">👶 求子</button>
          <button v-if="canClaimBirth" class="btn-action btn-claim" @click="onClaimBirth">🎉 出生（可领取）</button>
          <button v-if="!detail.isOfficial" class="btn-action btn-warn" @click="onAbandon">婉拒情缘</button>
          <button v-if="detail.isOfficial" class="btn-action btn-danger" :disabled="store.acting || (detail.pregnantUntil && pregnantRemain > 0)" @click="onDivorce">💔 和离</button>
          <button class="btn-action btn-art" @click="artModalOpen = true">🖼 贡献立绘</button>
        </div>

        <div v-if="detail.pregnantUntil && pregnantRemain > 0" class="detail-section pregnant-banner">
          ⏳ 怀胎中（剩余 {{ pregnantRemainText }}）{{ detail.pregnantCount > 1 ? `，胎数 ${detail.pregnantCount}` : '' }}
        </div>

        <div v-if="cooldownRemainText" class="detail-section divorce-cooldown-banner">
          ⏸ 和离冷却中（剩余 {{ cooldownRemainText }}），暂不可再结侣
        </div>
      </div>

      <!-- 贡献立绘弹窗 -->
      <div v-if="artModalOpen" class="confirm-overlay" @click.self="artModalOpen = false">
        <div class="art-modal">
          <div class="art-title">🖼 贡献「{{ detail.name }}」的立绘</div>
          <div class="art-body">
            <p class="art-intro">
              喜欢这位道侣？你可以用以下提示词去 <b style="color:#ffd700">即梦 / Midjourney / NovelAI</b> 等 AI 绘图工具出图，
              出好后<b style="color:#ff7eb3">在 QQ 群联系作者</b>提交，作者审核后会更新到该道侣身上，
              全服玩家都能看到你贡献的立绘！
            </p>
            <div class="art-contact">
              📩 QQ 群：<b class="art-qq">1098123817</b>
              <button class="btn-tiny" @click="copyText('1098123817')">复制</button>
            </div>
            <div class="art-prompt-label">提示词（专属于「{{ detail.name }}」）</div>
            <textarea readonly class="art-prompt" :value="customPrompt"></textarea>
            <div class="art-tips">
              <p>📌 建议规格：1024×1024 正方形，jpg/png/webp，单张 < 2MB</p>
              <p>📌 命名格式：<code>{{ detail.quality }}_{{ detail.personality }}.webp</code></p>
              <p>📌 若已有现成立绘也可直接发，作者会按提示词风格判断是否采纳</p>
            </div>
          </div>
          <div class="confirm-actions">
            <button class="btn-secondary" @click="copyText(customPrompt)">📋 复制提示词</button>
            <button class="btn-secondary" @click="artModalOpen = false">关闭</button>
          </div>
        </div>
      </div>

      <!-- 和离两层确认弹窗 -->
      <div v-if="divorceStep > 0" class="confirm-overlay" @click.self="cancelDivorce">
        <div class="confirm-modal">
          <template v-if="divorceStep === 1">
            <div class="confirm-title">⚠ 和离警告</div>
            <div class="confirm-body">
              和离将永久失去「{{ detail.name }}」，记录写入花名册档案，<b>子女由你抚养</b>。
              <br /><br />
              此操作不可撤销。
            </div>
            <div class="confirm-actions">
              <button class="btn-secondary" @click="cancelDivorce">取消</button>
              <button class="btn-danger" @click="divorceStep = 2">继续</button>
            </div>
          </template>
          <template v-else-if="divorceStep === 2">
            <div class="confirm-title">💔 消耗确认</div>
            <div class="confirm-body">
              <div>• 红尘解 ×1（消耗）</div>
              <div>• 灵石 ×{{ divorceStoneCost.toLocaleString() }}</div>
              <div>• 仙缘印记重置为 LV0</div>
              <div>• 和离冷却 24 小时（期间不可再结侣）</div>
              <div>• 风云阁公开广播</div>
            </div>
            <div class="confirm-actions">
              <button class="btn-secondary" @click="cancelDivorce">取消</button>
              <button class="btn-danger" :disabled="store.acting" @click="confirmDivorce">确认和离</button>
            </div>
          </template>
        </div>
      </div>

      <!-- 赠礼面板 -->
      <div v-if="giftPanelOpen" class="gift-panel-overlay" @click.self="giftPanelOpen = false">
        <div class="gift-panel">
          <div class="gift-head">
            <span class="gift-title">赠送礼物</span>
            <span class="gift-quota">今日剩余：{{ detail.dailyGiftRemaining }} / 50</span>
          </div>
          <div class="gift-list">
            <button
              v-for="recipe in giftCatalog"
              :key="recipe.id"
              :class="['gift-row', { 'is-loved': isLoved(recipe.id), 'is-disliked': isDisliked(recipe.id) }]"
              @click="confirmGift(recipe.id)"
              :disabled="store.acting"
            >
              <span class="gift-name">{{ recipe.name }}</span>
              <span class="gift-rarity">{{ rarityLabel(recipe.rarity) }}</span>
              <span class="gift-base">基础 +{{ recipe.baseIntimacy }} 亲密度</span>
              <span v-if="isLoved(recipe.id)" class="reaction love">喜爱 ×1.5</span>
              <span v-else-if="isDisliked(recipe.id)" class="reaction bad">厌恶 -3</span>
            </button>
          </div>
          <button class="btn-secondary" @click="giftPanelOpen = false">关闭</button>
        </div>
      </div>

      <div v-if="toast" class="toast">{{ toast }}</div>

      <!-- 约会弹窗 -->
      <CompanionDateModal
        v-if="dateModalOpen && detail"
        :companion-id="detail.id"
        @close="dateModalOpen = false"
        @done="onDateDone"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCompanionStore, type CompanionDetail } from '~/stores/companion'
import { useGameStore } from '~/stores/game'
import { avatarDataUrl, type AvatarQuality, type AvatarPersonality } from '~/game/companionAvatar'
import CompanionDateModal from './CompanionDateModal.vue'

const props = defineProps<{
  companionId: number
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useCompanionStore()
const detail = ref<CompanionDetail | null>(null)
const giftPanelOpen = ref(false)
const toast = ref('')

const SEAL_STATS = [0, 3, 5, 8, 12, 15]
const SEAL_COSTS = [0, 0, 500, 2000, 8000, 30000]  // LV1 是结侣赠送
const sealStat = computed(() => SEAL_STATS[detail.value?.sealLevel || 0] || 0)
const canMarry = computed(() => detail.value && !detail.value.isOfficial && detail.value.intimacy >= 600)
const canGift = computed(() => detail.value && detail.value.dailyGiftRemaining > 0)
const canDate = computed(() => detail.value && detail.value.isOfficial && detail.value.intimacy >= 250)
const canUpgradeSeal = computed(() => detail.value && detail.value.isOfficial && detail.value.sealLevel < 5)
const nextSealCost = computed(() => SEAL_COSTS[(detail.value?.sealLevel || 0) + 1] || 0)

// 怀胎状态
const pregnantRemain = computed(() => {
  if (!detail.value?.pregnantUntil) return 0
  return Math.max(0, new Date(detail.value.pregnantUntil).getTime() - Date.now())
})
const pregnantRemainText = computed(() => {
  const ms = pregnantRemain.value
  if (ms <= 0) return '已到期'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
})
const canConceive = computed(() => detail.value
  && detail.value.isOfficial
  && detail.value.intimacy >= 1000
  && !detail.value.pregnantUntil)
const canClaimBirth = computed(() => detail.value?.pregnantUntil && pregnantRemain.value === 0)

async function onConceive() {
  if (!confirm('开始怀胎？\n消耗：金莲花露 ×1 + 灵石 ×100万\n怀胎周期：48 小时')) return
  const res = await store.conceive()
  showToast(res.message || (res.ok ? '怀胎已开始' : res.message || '操作失败'))
  if (res.ok) detail.value = await store.loadDetail(props.companionId, true)
}

async function onClaimBirth() {
  const res = await store.conceiveClaim()
  showToast(res.message || '出生成功')
  if (res.ok) detail.value = await store.loadDetail(props.companionId, true)
}

const avatarUrl = computed(() => detail.value
  ? (detail.value.customAvatarUrl
      || avatarDataUrl(detail.value.quality as AvatarQuality, detail.value.personality as AvatarPersonality, 160))
  : '')

const dateModalOpen = ref(false)
function openDate() { dateModalOpen.value = true }

async function onUpgradeSeal() {
  if (!detail.value) return
  const cost = nextSealCost.value
  if (!confirm(`升级仙缘印记到 LV${detail.value.sealLevel + 1}？\n消耗 ${cost} 红尘玉。`)) return
  const api = useApi()
  const res = await api<{ code: number; message?: string; data?: any }>('/companion/seal-upgrade', {
    method: 'POST',
  })
  showToast(res.message || (res.code === 200 ? '升级成功' : '升级失败'))
  if (res.code === 200) {
    detail.value = await store.loadDetail(props.companionId, true)
  }
}

// 礼物列表（仅 Phase 1 凡-中品，参考 giftRecipeData.ts）
const giftCatalog = [
  { id: 'fruit_jam', name: '灵果蜜饯', rarity: 'low', baseIntimacy: 2 },
  { id: 'colorful_beads', name: '彩珠串', rarity: 'low', baseIntimacy: 2 },
  { id: 'peach_wine', name: '桃花酿', rarity: 'mid', baseIntimacy: 3 },
  { id: 'warm_jade_sachet', name: '温玉香囊', rarity: 'mid', baseIntimacy: 3 },
  { id: 'kiddy_beads', name: '童趣彩珠', rarity: 'mid', baseIntimacy: 3 },
  { id: 'frost_pendant', name: '寒玉佩', rarity: 'high', baseIntimacy: 5 },
  { id: 'purple_gold_hairpin', name: '紫金钗', rarity: 'high', baseIntimacy: 5 },
  { id: 'moonlight_pill', name: '月华丹', rarity: 'high', baseIntimacy: 5 },
]

function rarityLabel(r: string): string {
  return ({ low: '下品', mid: '中品', high: '上品', top: '极品', immortal: '仙品' } as any)[r] || r
}

function isLoved(giftId: string): boolean {
  return detail.value?.preferredGifts.includes(giftId) || false
}
function isDisliked(giftId: string): boolean {
  return detail.value?.dislikedGifts.includes(giftId) || false
}

const ITEM_NAMES: Record<string, string> = {
  silk_flower: '相思藤', butterfly_flower: '蝶恋花', moonlight_orchid: '月光兰',
  couple_lotus: '并蒂莲', lifelong_grass: '长情草', red_dust_flower: '红尘花',
  fruit_jam: '灵果蜜饯', colorful_beads: '彩珠串', peach_wine: '桃花酿',
  warm_jade_sachet: '温玉香囊', kiddy_beads: '童趣彩珠', frost_pendant: '寒玉佩',
  purple_gold_hairpin: '紫金钗', moonlight_pill: '月华丹', lotus_heart: '并蒂莲心',
  mandarin_pendant: '鸳鸯玉佩', red_dust_hairpin: '红尘仙缘簪',
}
function itemName(id: string): string { return ITEM_NAMES[id] || id }

function close() { emit('close') }
function openGift() { giftPanelOpen.value = true }

async function onMarry() {
  if (!detail.value) return
  if (!confirm(`确定与「${detail.value.name}」结为道侣？\n仙缘印记 LV1（+3% 全属性）将永久激活。`)) return
  const res = await store.marryCompanion(detail.value.id)
  showToast(res.message || (res.ok ? '结侣成功' : '结侣失败'))
  if (res.ok) {
    detail.value = await store.loadDetail(props.companionId, true)
  }
}

async function onAbandon() {
  if (!detail.value) return
  if (!confirm(`确定婉拒「${detail.value.name}」？\n该对象将从花名册中删除（无代价）。`)) return
  const res = await store.abandonCompanion(detail.value.id)
  showToast(res.message || (res.ok ? '已婉拒' : '操作失败'))
  if (res.ok) close()
}

// ===== 贡献立绘 =====
const artModalOpen = ref(false)

// 性格 → prompt 片段
const PERSONALITY_PROMPT: Record<string, string> = {
  '冷艳': '银白色长发飘逸，淡紫色冰蓝色眼眸，清冷绝美的神情，身穿白色冷蓝色长袍道袍，霜雪冰晶飘洒',
  '活泼': '橙红色长发飞扬，明亮金色眼眸，灿烂阳光的笑容，身穿橙红色襦裙，腰间斜挎长剑，火焰花瓣飘动',
  '温柔': '粉紫色长发披肩，柔和的浅蓝色眼眸，温婉如水的微笑，身穿粉紫色长裙绣花，胸前莲花玉佩，樱花花瓣飘落',
  '高傲': '深棕色长发盘高髻配金冠，凌厉的金色眼眸，冷艳挑眉，身穿金色凤纹华贵长袍，胸前龙凤玉佩，凤凰虚影展翅',
  '俏皮': '碧绿色双马尾，狡黠灵动的翠绿眼眸，俏皮的笑容露齿微笑，身穿青绿色短襦罗裙，肩头停一只小狐狸或小麻雀',
}

// 品质 → 氛围 prompt 片段
const QUALITY_PROMPT: string[] = [
  '朴素布衣线条简洁，无光晕，背景为山间小径或茅屋村落',
  '服饰简洁少量绣纹，淡绿色微光晕，灵气微现，背景为山林修行地',
  '服饰有银线刺绣花纹，中等蓝色灵气环绕，背景为云雾山峰',
  '金线绣纹华服，浓郁紫色光晕，灵气流转旋绕，背景为灵脉仙境',
  '多层金色光晕辉煌灿烂，仙鹤虚影展翅，云海仙宫剪影，背景金紫华丽',
  '红色仙光冲天，云雾缭绕九霄，凤凰或真龙虚影盘旋，背景仙宫云海',
]

const customPrompt = computed(() => {
  if (!detail.value) return ''
  const persona = PERSONALITY_PROMPT[detail.value.personality] || ''
  const quality = QUALITY_PROMPT[detail.value.quality] || ''
  return [
    `东方仙侠风格，中国古风插画，二次元立绘，单人半身像（头部到胸口），`,
    `精致五官，飘逸长发，灵气环绕，柔和电影光照，`,
    `一位绝美女子，道号「${detail.value.name}」，`,
    persona + '，',
    quality + '，',
    `画质精细，1024x1024 正方形构图，画面干净纯净，`,
    `无任何文字、水印、logo、签名、相框，画面统一画风`,
  ].join('\n')
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制到剪贴板')
  } catch {
    showToast('复制失败，请手动选中复制')
  }
}

// ===== 和离 =====
const divorceStep = ref(0)  // 0=未开启 / 1=警告 / 2=消耗确认
const gameStore = useGameStore()
const divorceStoneCost = computed(() => {
  const tier = gameStore.character?.realm_tier || 3
  return 5000 * 100 * Math.max(1, tier - 2)
})
const cooldownRemainText = computed(() => {
  const until = store.divorceCooldownUntil
  if (!until) return ''
  const ms = new Date(until).getTime() - Date.now()
  if (ms <= 0) return ''
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
})
function onDivorce() { divorceStep.value = 1 }
function cancelDivorce() { divorceStep.value = 0 }
async function confirmDivorce() {
  const res = await store.divorceCompanion()
  divorceStep.value = 0
  showToast(res.message || (res.ok ? '已和离' : '和离失败'))
  if (res.ok) close()
}

async function confirmGift(giftId: string) {
  if (!detail.value) return
  const res = await store.giftCompanion(detail.value.id, giftId, 1)
  showToast(res.message || (res.ok ? '赠送成功' : res.message || '赠送失败'))
  if (res.ok) {
    detail.value = await store.loadDetail(props.companionId, true)
  }
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2400)
}

async function onDateDone() {
  dateModalOpen.value = false
  detail.value = await store.loadDetail(props.companionId, true)
}

onMounted(async () => {
  detail.value = await store.loadDetail(props.companionId, true)
})
</script>

<style scoped>
.detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1500;
}
.detail-modal {
  background: linear-gradient(180deg, #1a1027, #2a1a3a);
  width: 92vw; max-width: 540px; max-height: 86vh;
  border-radius: 10px; border: 1px solid #b070ff;
  display: flex; flex-direction: column; overflow: hidden;
}
.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: rgba(80,40,100,0.5);
  border-bottom: 1px solid #5a3a7a;
}
.detail-title { color: #ffd700; font-size: 16px; font-weight: bold; }
.close-btn {
  background: transparent; border: none; color: #ddd;
  font-size: 22px; cursor: pointer;
}
.close-btn:hover { color: #fff; }

.detail-body {
  flex: 1; overflow-y: auto; padding: 14px 18px;
}
.detail-section {
  margin-bottom: 14px; padding: 10px 12px;
  background: rgba(40,20,60,0.4); border-radius: 6px;
  border: 1px solid #3a2050;
}
.section-head {
  color: #c8a8ff; font-size: 12px; margin-bottom: 6px;
  border-left: 2px solid #b070ff; padding-left: 6px;
}

.row {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 0; font-size: 13px;
}
.label { color: #aaa; min-width: 60px; }

.root-tag, .info-tag, .stage-tag {
  font-size: 12px; padding: 1px 8px; border-radius: 10px; font-weight: bold;
}
.root-metal { background: #d4d4d4; color: #444; }
.root-wood { background: #4caf50; color: #fff; }
.root-water { background: #4a90e2; color: #fff; }
.root-fire { background: #ef5350; color: #fff; }
.root-earth { background: #a87a4a; color: #fff; }
.info-tag { background: rgba(120,80,160,0.3); color: #c8a8ff; }
.info-tag.tag-gold { background: rgba(255,215,0,0.2); color: #ffd700; }
.stage-tag { background: rgba(255,150,200,0.2); color: #ff8cba; }
.intimacy-text { color: #ff8cba; font-weight: bold; }

.prefs { display: flex; flex-direction: column; gap: 6px; }
.prefs-label { color: #aaa; font-size: 12px; margin-right: 4px; }
.gift-tag {
  display: inline-block; padding: 1px 8px; margin-right: 4px;
  border-radius: 8px; font-size: 11px;
  background: rgba(255,200,100,0.15); color: #ffd700;
}
.gift-tag.tag-bad { background: rgba(255,100,100,0.2); color: #ff8888; }

.stages { display: flex; flex-wrap: wrap; gap: 6px; }
.stage-pill {
  font-size: 11px; padding: 2px 8px; border-radius: 8px;
  background: rgba(80,80,80,0.3); color: #888;
}
.stage-pill.unlocked {
  background: rgba(180,100,255,0.2); color: #c8a8ff;
}

.actions { display: flex; gap: 10px; }
.btn-primary {
  background: linear-gradient(135deg, #ff7eb3, #e55ba8);
  color: #fff; border: none; padding: 10px 20px; border-radius: 6px;
  font-weight: bold; cursor: pointer; width: 100%;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-action {
  background: rgba(80,40,100,0.6); color: #fff; border: 1px solid #6a4a8a;
  padding: 8px 14px; border-radius: 6px; cursor: pointer;
  font-size: 13px;
}
.btn-action:hover { background: rgba(120,60,150,0.7); }
.btn-action.btn-warn { border-color: #d4514c; color: #ff8c8c; }
.btn-action.btn-warn:hover { background: rgba(150,40,40,0.4); }
.btn-action.btn-date { border-color: #ff7eb3; color: #ffb8d4; }
.btn-action.btn-date:hover { background: rgba(255,126,179,0.25); }
.btn-action.btn-seal { border-color: #ffd700; color: #ffd700; }
.btn-action.btn-seal:hover { background: rgba(255,215,0,0.18); }
.btn-action.btn-conceive { border-color: #ffaa00; color: #ffaa00; }
.btn-action.btn-conceive:hover { background: rgba(255,170,0,0.2); }
.btn-action.btn-claim { border-color: #5fcf6f; color: #5fcf6f; animation: pulse 1.6s infinite; }
.btn-action.btn-claim:hover { background: rgba(95,207,111,0.2); }
.btn-action.btn-danger { border-color: #ff4444; color: #ff8080; }
.btn-action.btn-danger:hover { background: rgba(200,30,30,0.35); }
.btn-action.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-action.btn-art { border-color: #ff7eb3; color: #ffb8d4; }
.btn-action.btn-art:hover { background: rgba(255,126,179,0.25); }

/* 贡献立绘弹窗 */
.art-modal {
  background: linear-gradient(180deg, #2a1a3a, #1f1429);
  border: 1px solid #ff7eb3; border-radius: 12px;
  padding: 20px; width: 94%; max-width: 480px;
  max-height: 86vh; display: flex; flex-direction: column;
  box-shadow: 0 4px 28px rgba(255,126,179,0.3);
}
.art-title { color: #ff7eb3; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 14px; }
.art-body { flex: 1; overflow-y: auto; }
.art-intro { color: #d8c4f0; font-size: 13px; line-height: 1.7; padding: 10px; background: rgba(40,20,60,0.4); border-radius: 6px; margin-bottom: 10px; }
.art-intro b { color: #ffd700; }
.art-contact { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255,126,179,0.15); border: 1px solid #ff7eb3; border-radius: 6px; margin-bottom: 12px; font-size: 13px; color: #fff; }
.art-qq { color: #ffd700; font-size: 15px; font-family: monospace; }
.btn-tiny { background: #6a4a8a; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: auto; }
.btn-tiny:hover { background: #8a6aaa; }
.art-prompt-label { color: #c8a8ff; font-size: 12px; margin-bottom: 6px; }
.art-prompt {
  width: 100%; min-height: 180px; padding: 10px;
  background: #0f0815; color: #ddd;
  border: 1px solid #4a2a6a; border-radius: 6px;
  font-family: monospace; font-size: 12px; line-height: 1.6;
  resize: vertical; box-sizing: border-box; margin-bottom: 10px;
}
.art-tips { color: #aaa; font-size: 11px; line-height: 1.7; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; }
.art-tips p { margin: 2px 0; }
.art-tips code { background: #2a1a3a; color: #ffd700; padding: 1px 5px; border-radius: 3px; font-size: 11px; }

/* 和离冷却 banner */
.divorce-cooldown-banner {
  background: rgba(80,80,80,0.25);
  border: 1px solid #777;
  color: #ccc; text-align: center; font-size: 12px;
}

/* 两层确认弹窗 */
.confirm-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 20;
}
.confirm-modal {
  background: #1f1429; border: 1px solid #ff4444;
  border-radius: 10px; padding: 22px;
  width: 92%; max-width: 380px;
  box-shadow: 0 4px 24px rgba(255,68,68,0.3);
}
.confirm-title {
  color: #ff8080; font-size: 16px; font-weight: bold;
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
  background: rgba(200,30,30,0.3); border-color: #ff4444; color: #fff;
}
.btn-danger:hover { background: rgba(220,40,40,0.5); }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(95,207,111,0); }
  50% { box-shadow: 0 0 12px rgba(95,207,111,0.5); }
}
.pregnant-banner {
  background: rgba(255,170,0,0.1);
  border: 1px solid #ffaa00;
  color: #ffd700; text-align: center; font-size: 13px;
}

.hero {
  display: flex; align-items: center; gap: 14px;
  padding: 12px;
  background: rgba(40,20,60,0.4); border-radius: 6px;
  border: 1px solid #3a2050;
  margin-bottom: 14px;
}
.hero-avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(180,100,255,0.4);
}
.hero-meta {
  display: flex; flex-direction: column; gap: 6px;
}
.hero-meta .quality-tag {
  font-size: 13px; padding: 3px 10px; border-radius: 12px;
  font-weight: bold; align-self: flex-start;
}
.quality-white { background: #d4d4d4; color: #444; }
.quality-green { background: #4caf50; color: #fff; }
.quality-blue { background: #4a90e2; color: #fff; }
.quality-purple { background: #9933ff; color: #fff; }
.quality-gold { background: #ffaa00; color: #fff; }
.quality-red { background: #ff3333; color: #fff; }
.official-tag { color: #ffd700; font-size: 12px; font-weight: bold; }

/* 赠礼面板 */
.gift-panel-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
}
.gift-panel {
  background: #1f1429; border: 1px solid #b070ff;
  border-radius: 10px; padding: 16px; width: 90%; max-width: 440px;
  max-height: 80%; display: flex; flex-direction: column;
}
.gift-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.gift-title { color: #ffd700; font-size: 15px; font-weight: bold; }
.gift-quota { color: #c8a8ff; font-size: 12px; }
.gift-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
}
.gift-row {
  display: grid; grid-template-columns: 1fr auto auto auto;
  align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 6px;
  background: rgba(40,20,60,0.6); border: 1px solid #3a2050;
  color: #ddd; cursor: pointer; text-align: left;
  font-size: 13px;
}
.gift-row:hover:not(:disabled) {
  border-color: #b070ff; background: rgba(70,40,90,0.7);
}
.gift-row:disabled { opacity: 0.5; cursor: not-allowed; }
.gift-row.is-loved { border-color: #ffd700; }
.gift-row.is-disliked { border-color: #d4514c; opacity: 0.7; }
.gift-name { color: #fff; font-weight: bold; }
.gift-rarity { color: #c8a8ff; font-size: 11px; }
.gift-base { color: #aaa; font-size: 11px; }
.reaction { font-size: 11px; padding: 1px 6px; border-radius: 6px; font-weight: bold; }
.reaction.love { background: rgba(255,215,0,0.2); color: #ffd700; }
.reaction.bad { background: rgba(255,100,100,0.2); color: #ff8888; }
.btn-secondary {
  margin-top: 10px;
  background: #555; color: #fff; border: none;
  padding: 8px; border-radius: 6px; cursor: pointer;
}

.toast {
  position: fixed; bottom: 20%; left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.85); color: #ffd700;
  padding: 10px 18px; border-radius: 6px;
  border: 1px solid #b070ff; font-size: 13px;
  z-index: 3000;
}
</style>
