<template>
  <div class="birth-overlay">
    <div class="birth-modal">
      <div class="birth-header">
        <span class="title">{{ titleText }}</span>
      </div>

      <div class="birth-body">
        <div v-for="(b, i) in births" :key="i" class="birth-card" :class="`apt-${b.child.aptitude}`">
          <img class="birth-avatar" :src="childAvatarDataUrl(b.child.gender, b.child.aptitude)" :alt="b.child.name" />
          <div class="birth-info">
            <div class="line-name">
              <span class="name">{{ b.child.name }}</span>
              <span :class="['gender', b.child.gender]">{{ b.child.gender === 'male' ? '♂' : '♀' }}</span>
              <span v-if="b.child.awakened" class="awaken-tag">✦ 血脉觉醒</span>
            </div>
            <div class="line-stat">
              <span class="aptitude-tag">{{ aptName(b.child.aptitude) }}</span>
              <span class="root-tag">{{ rootName(b.child.spiritual_root) }}灵根</span>
            </div>
            <div v-if="b.firstTalent" class="line-talent">
              天赋（首次）：<span class="talent-name" :class="`rarity-${b.firstTalent.rarity}`">{{ b.firstTalent.name }}</span>
              <span class="talent-desc">{{ b.firstTalent.description }}</span>
            </div>
            <div v-if="b.innateSkill" class="line-skill">
              血脉功法：<span class="skill-name" :class="`rarity-${b.innateSkill.rarity}`">{{ b.innateSkill.name }}</span>
              <span class="skill-desc">{{ b.innateSkill.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="birth-actions">
        <button class="btn-primary" @click="$emit('close')">查看子女</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { childAvatarDataUrl } from '~/game/companionAvatar'

const props = defineProps<{ births: any[] }>()
defineEmits<{ (e: 'close'): void }>()

const titleText = computed(() => {
  if (props.births.length >= 3) return '🎉 三胎之喜！'
  if (props.births.length === 2) return '🎉 双胎之喜！'
  return '🎉 弄璋之喜！'
})

const APT_NAMES = ['凡品', '下品', '中品', '上品', '极品', '仙品', '圣品']
function aptName(a: number): string { return APT_NAMES[a] || '凡品' }

const ROOT_NAMES: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土', mixed: '混' }
function rootName(r: string): string { return ROOT_NAMES[r] || r }
</script>

<style scoped>
.birth-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2500;
}
.birth-modal {
  background: linear-gradient(180deg, #2a1f44, #3a2a5a);
  border: 2px solid #ffd700;
  border-radius: 12px; padding: 0;
  width: 92vw; max-width: 600px;
  box-shadow: 0 0 40px rgba(255,215,0,0.4);
  overflow: hidden;
}
.birth-header {
  background: linear-gradient(90deg, #6a3a2a, #c4824a);
  padding: 16px; text-align: center;
}
.birth-header .title {
  color: #fff; font-size: 22px; font-weight: bold;
  text-shadow: 0 2px 6px rgba(0,0,0,0.4);
}

.birth-body { padding: 16px; max-height: 60vh; overflow-y: auto; }
.birth-card {
  display: flex; gap: 14px;
  padding: 14px;
  background: rgba(0,0,0,0.3);
  border: 1px solid #5a3a7a;
  border-radius: 8px; margin-bottom: 10px;
}
.birth-card.apt-4 { border-color: #ffaa00; box-shadow: 0 0 12px rgba(255,170,0,0.2); }
.birth-card.apt-5 { border-color: #ff3333; box-shadow: 0 0 14px rgba(255,80,80,0.3); }
.birth-card.apt-6 { border-color: #ffd700; box-shadow: 0 0 18px rgba(255,215,0,0.4); }

.birth-avatar { width: 84px; height: 84px; border-radius: 50%; flex-shrink: 0; }
.birth-info { flex: 1; min-width: 0; }
.line-name { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.name { color: #ffd700; font-size: 18px; font-weight: bold; }
.gender { font-size: 16px; }
.gender.male { color: #4a9eff; }
.gender.female { color: #ff7eb3; }
.awaken-tag { color: #ff8cba; font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(255,140,186,0.2); font-weight: bold; }

.line-stat { margin-bottom: 8px; }
.aptitude-tag, .root-tag { padding: 2px 10px; border-radius: 10px; font-size: 12px; margin-right: 6px; font-weight: bold; }
.aptitude-tag { background: rgba(255,215,0,0.25); color: #ffd700; }
.root-tag { background: rgba(120,80,160,0.3); color: #c8a8ff; }

.line-talent, .line-skill {
  font-size: 12px; color: #ccc; margin-top: 4px;
  line-height: 1.6;
}
.talent-name, .skill-name { font-weight: bold; }
.rarity-common { color: #cfcfcf; }
.rarity-uncommon, .rarity-green { color: #5fcf6f; }
.rarity-rare, .rarity-blue { color: #5fa0e8; }
.rarity-epic, .rarity-purple { color: #c87aff; }
.rarity-legendary, .rarity-gold { color: #ffd366; }
.rarity-red { color: #ff8888; }
.talent-desc, .skill-desc { color: #aaa; margin-left: 6px; }

.birth-actions {
  padding: 14px 16px;
  background: rgba(0,0,0,0.3);
  border-top: 1px solid #5a3a7a;
  text-align: center;
}
.btn-primary {
  background: linear-gradient(135deg, #ffd700, #ffa500);
  color: #1a1027; border: none;
  padding: 10px 30px; border-radius: 6px;
  font-weight: bold; font-size: 14px; cursor: pointer;
}
</style>
