<template>
  <AdminShell title="操作审计">
    <div class="admin-row admin-mb">
      <select v-model="filter.action" class="admin-select" style="width: 180px;" @change="reload(1)">
        <option value="">全部操作</option>
        <option v-for="a in ACTIONS" :key="a.code" :value="a.code">{{ a.name }}</option>
      </select>
      <input
        v-model.number="filter.target_character_id"
        type="number"
        class="admin-input"
        placeholder="玩家 ID 筛选"
        style="width: 140px;"
        @keyup.enter="reload(1)"
      />
      <button class="admin-btn ghost" @click="reload(1)">查询</button>
      <button class="admin-btn ghost" @click="resetFilter">清空</button>
      <span class="text-dim" style="margin-left: auto;">共 {{ total }} 条</span>
    </div>

    <div v-if="loading" class="admin-loading">加载中...</div>
    <div v-else-if="items.length === 0" class="admin-empty">暂无记录</div>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作员</th>
            <th>操作</th>
            <th>目标玩家</th>
            <th>详情</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="text-dim">{{ fmtDate(row.created_at) }}</td>
            <td>{{ row.admin_username || '—' }}</td>
            <td><span class="admin-tag" :class="actionClass(row.action)">{{ actionName(row.action) }}</span></td>
            <td>
              <NuxtLink v-if="row.target_character_id" :to="`/admin/players/${row.target_character_id}`" style="color: var(--primary-hover); text-decoration: none;">
                {{ row.target_character_name || `#${row.target_character_id}` }}
              </NuxtLink>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="text-dim" style="max-width: 460px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <code style="font-size: 11px;">{{ JSON.stringify(row.payload) }}</code>
            </td>
            <td class="text-muted">{{ row.ip || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <button class="admin-btn ghost small" :disabled="page <= 1" @click="reload(page - 1)">上一页</button>
      <span class="text-dim">{{ page }} / {{ Math.max(1, Math.ceil(total / 30)) }}</span>
      <button class="admin-btn ghost small" :disabled="page * 30 >= total" @click="reload(page + 1)">下一页</button>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const api = useAdminApi()
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const filter = reactive({ action: '', target_character_id: 0 })

const ACTIONS = [
  { code: 'deliver_order', name: '订单发货', cls: 'primary' },
  { code: 'edit_package', name: '编辑商品', cls: '' },
  { code: 'grant_currency', name: '发放货币', cls: 'success' },
  { code: 'grant_skills', name: '发放功法', cls: 'success' },
  { code: 'grant_item', name: '发放道具', cls: 'success' },
  { code: 'reset_daily', name: '重置每日', cls: 'info' },
  { code: 'level_down', name: '降级', cls: 'warning' },
  { code: 'send_mail', name: '发送邮件', cls: 'info' },
  { code: 'ban', name: '封号', cls: 'danger' },
  { code: 'unban', name: '解封', cls: 'success' },
]
function actionName(c: string) { return ACTIONS.find(a => a.code === c)?.name || c }
function actionClass(c: string) { return ACTIONS.find(a => a.code === c)?.cls || '' }

function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

async function reload(p: number) {
  loading.value = true
  page.value = p
  try {
    const params = new URLSearchParams({ page: String(p), limit: '30' })
    if (filter.action) params.set('action', filter.action)
    if (filter.target_character_id > 0) params.set('target_character_id', String(filter.target_character_id))
    const res = await api<any>(`/admin/audit?${params}`)
    items.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filter.action = ''
  filter.target_character_id = 0
  reload(1)
}

onMounted(() => reload(1))
</script>
