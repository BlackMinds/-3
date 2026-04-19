<template>
  <div :class="['slot', { filled: modelValue != null }]">
    <div class="slot-label">{{ label }}</div>
    <select :value="modelValue ?? ''" @change="onChange">
      <option value="">-- 请选择 --</option>
      <option v-for="m in availableMembers" :key="m.character_id" :value="m.character_id">
        {{ m.name }} · {{ realmText(m.realm_tier, m.realm_stage) }} · Lv.{{ m.level }}
      </option>
    </select>
    <div v-if="selectedMember" class="slot-info">
      <span class="role-tag" :style="{ background: roleColor(selectedMember.role) }">{{ roleName(selectedMember.role) }}</span>
      <span class="contrib">贡献 {{ selectedMember.contribution }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  members: any[]
  exclude: number[]
  label: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number | null): void }>()

const selectedMember = computed(() => props.members.find(m => m.character_id === props.modelValue))

const availableMembers = computed(() => {
  // 当前已选中的始终可见，其他 slot 已占的排除
  return props.members.filter(m => m.character_id === props.modelValue || !props.exclude.includes(m.character_id))
})

function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:modelValue', v ? Number(v) : null)
}

function realmText(tier: number, stage: number) {
  const tiers = ['凡人','练气','筑基','金丹','元婴','化神','渡劫','大乘','飞升','万法']
  const stages = ['一','二','三','四','五','六','七','八','九']
  return `${tiers[tier] || ''}${stages[stage - 1] || ''}层`
}
function roleName(r: string) {
  return { leader: '宗主', vice_leader: '副宗', elder: '长老', inner: '内门', outer: '外门' }[r] || r
}
function roleColor(r: string) {
  return { leader: '#ffd700', vice_leader: '#ff8', elder: '#c9a85c', inner: '#7a9', outer: '#888' }[r] || '#555'
}
</script>

<style scoped>
.slot {
  background: #22223a; border: 1px dashed #444; border-radius: 6px;
  padding: 10px; transition: all 0.15s;
}
.slot.filled { border-style: solid; border-color: #7a5ca8; background: #2a1f3a; }
.slot-label { font-size: 13px; color: #888; margin-bottom: 4px; }
.slot select {
  width: 100%; background: #0e0e1a; border: 1px solid #444;
  color: #e0e0f0; padding: 6px 8px; border-radius: 4px;
  font-size: 14px; cursor: pointer;
}
.slot-info {
  display: flex; align-items: center; gap: 8px;
  margin-top: 6px; font-size: 13px;
}
.role-tag {
  padding: 1px 6px; border-radius: 3px; color: #000; font-size: 12px;
}
.contrib { color: #888; }
</style>
