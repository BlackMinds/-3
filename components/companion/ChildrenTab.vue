<template>
  <div class="children-tab">
    <div v-if="store.children.length === 0" class="empty-hint">
      暂无子女。<br>正式结侣后亲密度 ≥ 800 可在道侣详情中"求子"。
    </div>

    <div v-else>
      <div class="section-title">⚔ 出战配置（仅 1 个槽位）</div>
      <div class="battling-slot">
        <div v-if="battlingChild" class="battling-card">
          <img :src="childAvatarSrc(battlingChild)" :alt="battlingChild.name" />
          <div>
            <div class="bc-name">{{ battlingChild.name }}（{{ battlingChild.stageName }} Lv.{{ battlingChild.level }}）</div>
            <div class="bc-stats">攻 {{ battlingChild.atk }} 防 {{ battlingChild.def }} 身法 {{ battlingChild.spd }}</div>
          </div>
          <button class="btn-secondary" @click="onCancelBattling">取消助战</button>
        </div>
        <div v-else class="battling-empty">[助战槽位 · 空] 选一个少年期及以上的子女出战</div>
      </div>

      <div v-if="homeChildren.length > 0" class="section-title">📜 在家子女（{{ homeChildren.length }} 位）</div>
      <div v-if="homeChildren.length > 0" class="children-list">
        <div
          v-for="c in homeChildren"
          :key="c.id"
          :class="['child-card', `apt-${c.aptitude}`]"
          @click="openDetail(c.id)"
        >
          <img class="child-avatar" :src="childAvatarSrc(c)" :alt="c.name" />
          <div class="child-body">
            <div class="cc-head">
              <span class="cc-name">{{ c.name }}</span>
              <span :class="['cc-gender', c.gender]">{{ c.gender === 'male' ? '♂' : '♀' }}</span>
              <span class="cc-aptitude">{{ c.aptitudeName }}</span>
              <span v-if="c.awakened" class="cc-awakened">✦ 血脉觉醒</span>
              <span v-if="c.isBattling" class="cc-battling">⚔ 助战中</span>
              <span v-if="c.level >= 100" class="cc-adult">🎉 已成年</span>
            </div>
            <div class="cc-info">
              {{ c.stageName }} · Lv.{{ c.level }} · {{ rootName(c.spiritualRoot) }}灵根
            </div>
            <div class="cc-stats">攻 {{ c.atk }} · 防 {{ c.def }} · 血 {{ c.maxHp }} · 身法 {{ c.spd }}</div>
          </div>
        </div>
      </div>

      <div v-if="leftChildren.length > 0" class="section-title">🌿 外出历练中（{{ leftChildren.length }} 位 · 累计 +{{ totalLeftBuffPct }}%）</div>
      <div v-if="leftChildren.length > 0" class="children-list">
        <div
          v-for="c in leftChildren"
          :key="c.id"
          :class="['child-card', `apt-${c.aptitude}`, 'left-home']"
          @click="openDetail(c.id)"
        >
          <img class="child-avatar" :src="childAvatarSrc(c)" :alt="c.name" />
          <div class="child-body">
            <div class="cc-head">
              <span class="cc-name">{{ c.name }}</span>
              <span :class="['cc-gender', c.gender]">{{ c.gender === 'male' ? '♂' : '♀' }}</span>
              <span class="cc-aptitude">{{ c.aptitudeName }}</span>
              <span class="cc-leave">🌿 历练中</span>
            </div>
            <div class="cc-info">
              Lv.{{ c.level }} · {{ rootName(c.spiritualRoot) }}灵根 · 永久属性 <b>+{{ buffPct(c.permanentBuffPct) }}%</b>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ChildDetailModal
      v-if="detailChildId"
      :child-id="detailChildId"
      @close="detailChildId = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useCompanionStore } from '~/stores/companion'
import { childAvatarDataUrl } from '~/game/companionAvatar'
import ChildDetailModal from './ChildDetailModal.vue'

const store = useCompanionStore()
const detailChildId = ref<number | null>(null)

const battlingChild = computed(() => store.children.find((c: any) => c.isBattling))
const homeChildren = computed(() => store.children.filter((c: any) => !c.hasLeftHome))
const leftChildren = computed(() => store.children.filter((c: any) => c.hasLeftHome))
const totalLeftBuffPct = computed(() => {
  const sum = leftChildren.value.reduce((a: number, c: any) => a + Number(c.permanentBuffPct || 0), 0)
  return (sum * 100).toFixed(1)
})
function buffPct(p: any): string { return (Number(p || 0) * 100).toFixed(1) }

const ROOT_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土', mixed: '混' }
function rootName(r: string): string { return ROOT_NAMES[r] || r }

// 优先用自定义头像（customAvatarUrl），否则回退到 SVG 占位
function childAvatarSrc(c: any): string {
  return c?.customAvatarUrl || childAvatarDataUrl(c.gender, c.aptitude)
}

function openDetail(id: number) { detailChildId.value = id }

async function onCancelBattling() {
  const res = await store.setBattlingChild(null)
  if (!res.ok) alert(res.message)
}

onMounted(async () => {
  await store.loadChildren()
})
</script>

<style scoped>
.children-tab { display: flex; flex-direction: column; gap: 12px; }

.empty-hint {
  text-align: center; padding: 32px 12px;
  color: #aaa; font-size: 13px; line-height: 1.7;
}

.section-title {
  color: #c8a8ff; font-size: 13px;
  border-left: 3px solid #b070ff; padding-left: 8px;
  margin-top: 8px;
}

.battling-slot {
  padding: 8px;
  background: rgba(80,40,100,0.2);
  border: 1px solid #4a2a6a;
  border-radius: 8px;
}
.battling-card {
  display: flex; align-items: center; gap: 12px;
}
.battling-card img { width: 56px; height: 56px; border-radius: 50%; }
.bc-name { color: #ffd700; font-size: 14px; font-weight: bold; }
.bc-stats { color: #c8a8ff; font-size: 12px; margin-top: 4px; }
.battling-empty {
  text-align: center; color: #888; padding: 14px;
  font-size: 12px; font-style: italic;
}
.btn-secondary {
  background: #555; color: #fff; border: none;
  padding: 6px 12px; border-radius: 6px; cursor: pointer;
  margin-left: auto; font-size: 12px;
}

.children-list { display: flex; flex-direction: column; gap: 8px; }
.child-card {
  display: flex; gap: 10px; padding: 10px 12px;
  border: 1px solid #4a2a6a; background: rgba(40,20,60,0.5);
  border-radius: 8px; cursor: pointer; transition: all 0.2s;
}
.child-card:hover {
  border-color: #b070ff; background: rgba(70,40,90,0.55);
  transform: translateX(2px);
}
.child-card.apt-3 { border-color: #9933ff; }
.child-card.apt-4 { border-color: #ffaa00; }
.child-card.apt-5 { border-color: #ff3333; box-shadow: 0 0 10px rgba(255,80,80,0.2); }
.child-card.apt-6 { border-color: #ffd700; box-shadow: 0 0 14px rgba(255,215,0,0.3); }
.child-card.left-home { opacity: 0.85; background: rgba(95,207,111,0.06); border-style: dashed; }
.child-card.left-home:hover { background: rgba(95,207,111,0.12); }
.cc-leave { color: #5fcf6f; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: rgba(95,207,111,0.18); }
.cc-adult { color: #ffd700; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: rgba(255,215,0,0.2); animation: pulse-adult 2s infinite; }
@keyframes pulse-adult {
  0%, 100% { box-shadow: 0 0 0 rgba(255,215,0,0); }
  50% { box-shadow: 0 0 8px rgba(255,215,0,0.5); }
}
.cc-info b { color: #5fcf6f; }

.child-avatar { width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0; }
.child-body { flex: 1; min-width: 0; }
.cc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cc-name { color: #fff; font-size: 14px; font-weight: bold; }
.cc-gender { font-size: 14px; }
.cc-gender.male { color: #4a9eff; }
.cc-gender.female { color: #ff7eb3; }
.cc-aptitude { color: #ffd700; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: rgba(255,215,0,0.2); }
.cc-awakened { color: #ff8cba; font-size: 11px; padding: 1px 6px; border-radius: 6px; background: rgba(255,140,186,0.2); }
.cc-battling { color: #ffd700; font-size: 11px; }
.cc-info { color: #ccc; font-size: 12px; margin-top: 4px; }
.cc-stats { color: #aaa; font-size: 11px; margin-top: 2px; }
</style>
