<template>
  <AdminShell title="概览">
    <div v-if="loading" class="admin-loading">加载中...</div>
    <template v-else-if="data">
      <h2 class="admin-mb">数据总览</h2>
      <div class="admin-grid">
        <div class="admin-card">
          <p class="admin-card-title">玩家总数</p>
          <div class="admin-card-value">{{ data.totalCharacters.toLocaleString() }}</div>
          <p class="admin-card-sub">今日新增 +{{ data.newToday }}</p>
        </div>
        <div class="admin-card">
          <p class="admin-card-title">7 日活跃</p>
          <div class="admin-card-value">{{ data.activeWeek.toLocaleString() }}</div>
          <p class="admin-card-sub">基于 last_active_at</p>
        </div>
        <div class="admin-card">
          <p class="admin-card-title">今日订单</p>
          <div class="admin-card-value">{{ data.ordersToday }}</div>
          <p class="admin-card-sub">¥{{ data.revenueToday.toFixed(2) }}</p>
        </div>
        <div class="admin-card">
          <p class="admin-card-title">累计订单</p>
          <div class="admin-card-value">{{ data.ordersAll }}</div>
          <p class="admin-card-sub">¥{{ data.revenueAll.toFixed(2) }}</p>
        </div>
        <div class="admin-card">
          <p class="admin-card-title">在效月卡玩家</p>
          <div class="admin-card-value">{{ data.activeSubscribers }}</div>
          <p class="admin-card-sub">任一月卡未过期</p>
        </div>
      </div>

      <h2 class="admin-mb admin-mt">快捷入口</h2>
      <div class="admin-row admin-gap-sm">
        <NuxtLink to="/admin/players" class="admin-btn">查询玩家</NuxtLink>
        <NuxtLink to="/admin/orders" class="admin-btn ghost">查看订单</NuxtLink>
        <NuxtLink to="/admin/packages" class="admin-btn ghost">商品配置</NuxtLink>
      </div>
    </template>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const api = useAdminApi()
const loading = ref(true)
const data = ref<any>(null)

onMounted(async () => {
  try {
    const res = await api<any>('/admin/dashboard')
    data.value = res.data
  } finally {
    loading.value = false
  }
})
</script>
