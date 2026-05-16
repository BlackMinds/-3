<template>
  <AdminShell title="商品配置">
    <div class="admin-card admin-mb">
      <p class="text-dim">
        共 <strong>{{ items.length }}</strong> 个商品 ·
        启用 <span class="text-success">{{ items.filter(i => i.enabled).length }}</span> ·
        禁用 <span class="text-danger">{{ items.filter(i => !i.enabled).length }}</span>
      </p>
      <p class="text-muted admin-mb-sm" style="font-size: 12px;">
        修改 type 和 payload 需要直接编辑 <code>scripts/seed-packages.mjs</code> 后重跑（涉及发货逻辑）。
      </p>
    </div>

    <div v-if="loading" class="admin-loading">加载中...</div>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>code</th>
            <th>名称</th>
            <th class="num">价格 ¥</th>
            <th>type</th>
            <th>payload</th>
            <th style="min-width: 280px;">详细说明</th>
            <th>启用</th>
            <th class="num">排序</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="text-dim">{{ row.id }}</td>
            <td class="text-dim"><code>{{ row.code }}</code></td>
            <td>
              <input v-if="editingId === row.id" v-model="editForm.name" class="admin-input" style="width: 220px;" />
              <strong v-else>{{ row.name }}</strong>
            </td>
            <td class="num">
              <input v-if="editingId === row.id" v-model.number="editForm.price_rmb" type="number" step="0.01" class="admin-input" style="width: 90px; text-align: right;" />
              <span v-else>¥{{ Number(row.price_rmb).toFixed(2) }}</span>
            </td>
            <td><span class="admin-tag">{{ typeName(row.type) }}</span></td>
            <td class="text-muted" style="font-size: 12px;">{{ payloadDesc(row.type, row.payload) }}</td>
            <td style="white-space: normal; line-height: 1.5; max-width: 380px;">
              <textarea v-if="editingId === row.id" v-model="editForm.description" class="admin-textarea" rows="4" style="width: 100%; font-size: 12px;" placeholder="给玩家看的卖货文案"></textarea>
              <span v-else class="text-dim" style="font-size: 12px;">{{ row.description || '—' }}</span>
            </td>
            <td>
              <span v-if="row.enabled" class="admin-tag success">启用</span>
              <span v-else class="admin-tag danger">禁用</span>
            </td>
            <td class="num">
              <input v-if="editingId === row.id" v-model.number="editForm.sort_order" type="number" class="admin-input" style="width: 60px; text-align: right;" />
              <span v-else>{{ row.sort_order }}</span>
            </td>
            <td>
              <template v-if="editingId === row.id">
                <button class="admin-btn small" :disabled="saving" @click="save(row.id)">保存</button>
                <button class="admin-btn ghost small" @click="cancel()">取消</button>
              </template>
              <template v-else>
                <button class="admin-btn ghost small" @click="edit(row)">编辑</button>
                <button class="admin-btn small" :class="row.enabled ? 'danger' : ''" @click="toggle(row)">
                  {{ row.enabled ? '禁用' : '启用' }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const api = useAdminApi()
const items = ref<any[]>([])
const loading = ref(true)
const editingId = ref<number | null>(null)
const editForm = reactive({ name: '', description: '', price_rmb: 0, sort_order: 0 })
const saving = ref(false)

const TYPE_NAMES: Record<string, string> = {
  sub_cave_mul: '洞府倍率',
  sub_oneclick_plant: '一键种植',
  sub_bonus_plot: '灵田扩容',
  sub_sr_bonus: '秘境次数',
  sub_expedition_bonus: '游历次数月卡',
  sub_tower_bonus: '通天塔月卡',
  one_time_expedition_count: '游历次数·单次',
  one_time_tower_count: '通天塔·单次',
  item_pill: '道具',
}
function typeName(t: string) { return TYPE_NAMES[t] || t }

function payloadDesc(type: string, p: any): string {
  if (!p) return ''
  switch (type) {
    case 'sub_cave_mul': return `${p.multiplier}x · ${p.days}天`
    case 'sub_oneclick_plant': return `${p.days}天`
    case 'sub_bonus_plot': return `+${p.count}块 · ${p.days}天`
    case 'sub_sr_bonus': return `+${p.bonus}/天 · ${p.days}天`
    case 'sub_expedition_bonus': return `+${p.bonus}/天 · ${p.days}天`
    case 'sub_tower_bonus': return `+${p.bonus}/天 · ${p.days}天`
    case 'one_time_expedition_count': return `+${p.count} 次（仅今日）`
    case 'one_time_tower_count': return `+${p.count} 次（仅今日）`
    case 'item_pill': return `${p.pill_id} ×${p.count}`
    default: return JSON.stringify(p)
  }
}

async function reload() {
  loading.value = true
  try {
    const res = await api<any>('/admin/packages')
    items.value = res.data.items
  } finally {
    loading.value = false
  }
}

function edit(row: any) {
  editingId.value = row.id
  editForm.name = row.name
  editForm.description = row.description || ''
  editForm.price_rmb = Number(row.price_rmb)
  editForm.sort_order = row.sort_order
}
function cancel() { editingId.value = null }

async function save(id: number) {
  saving.value = true
  try {
    const res = await api<any>(`/admin/packages/${id}`, {
      method: 'PATCH', body: { ...editForm },
    })
    if (res.code === 200) {
      editingId.value = null
      await reload()
    } else {
      alert(res.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function toggle(row: any) {
  if (!confirm(`确认${row.enabled ? '禁用' : '启用'}「${row.name}」？`)) return
  const res = await api<any>(`/admin/packages/${row.id}`, {
    method: 'PATCH', body: { enabled: !row.enabled },
  })
  if (res.code === 200) await reload()
  else alert(res.message || '操作失败')
}

onMounted(reload)
</script>
