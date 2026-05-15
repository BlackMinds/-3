<template>
  <AdminShell title="玩家管理">
    <div class="admin-row admin-mb">
      <input
        v-model="q"
        class="admin-input"
        placeholder="搜索 道号 / 账号..."
        style="max-width: 300px;"
        @keyup.enter="reload(1)"
      />
      <button class="admin-btn" @click="reload(1)">搜索</button>
      <button class="admin-btn ghost" @click="q = ''; reload(1)">清空</button>
      <span class="text-dim" style="margin-left: auto;">共 {{ total }} 条</span>
    </div>

    <div v-if="loading" class="admin-loading">加载中...</div>
    <div v-else-if="items.length === 0" class="admin-empty">未找到玩家</div>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>道号</th>
            <th>账号</th>
            <th>等级</th>
            <th>境界</th>
            <th class="num">灵石</th>
            <th>月卡</th>
            <th>最近活跃</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="text-dim">{{ row.id }}</td>
            <td><strong>{{ row.name }}</strong></td>
            <td class="text-dim">{{ row.username }}</td>
            <td class="num">Lv.{{ row.level }}</td>
            <td>{{ realmName(row.realm_tier, row.realm_stage) }}</td>
            <td class="num">{{ Number(row.spirit_stone).toLocaleString() }}</td>
            <td>
              <span v-if="row.has_active_sub" class="admin-tag success">在效</span>
              <span v-else class="admin-tag">无</span>
            </td>
            <td class="text-dim">{{ fmtDate(row.last_active_at) }}</td>
            <td>
              <span v-if="row.user_status === 1" class="admin-tag success">正常</span>
              <span v-else class="admin-tag danger">封禁</span>
            </td>
            <td>
              <NuxtLink :to="`/admin/players/${row.id}`" class="admin-btn small">详情</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <button class="admin-btn ghost small" :disabled="page <= 1" @click="reload(page - 1)">上一页</button>
      <span class="text-dim">{{ page }} / {{ Math.max(1, Math.ceil(total / limit)) }}</span>
      <button class="admin-btn ghost small" :disabled="page * limit >= total" @click="reload(page + 1)">下一页</button>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const api = useAdminApi()
const q = ref('')
const page = ref(1)
const limit = ref(20)
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const REALM_NAMES = ['', '练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '飞升']

function realmName(tier: number, stage: number) {
  return `${REALM_NAMES[tier] || '?'} ${stage}层`
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function reload(p: number) {
  loading.value = true
  page.value = p
  try {
    const res = await api<any>(`/admin/players?q=${encodeURIComponent(q.value)}&page=${p}&limit=${limit.value}`)
    items.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

onMounted(() => reload(1))
</script>
