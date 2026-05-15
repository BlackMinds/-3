<template>
  <div class="admin-app">
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <h1>仙途后台</h1>
        <nav class="admin-nav">
          <NuxtLink to="/admin/dashboard">概览</NuxtLink>
          <NuxtLink to="/admin/players">玩家管理</NuxtLink>
          <NuxtLink to="/admin/orders">充值订单</NuxtLink>
          <NuxtLink to="/admin/packages">商品配置</NuxtLink>
          <NuxtLink to="/admin/audit">操作审计</NuxtLink>
        </nav>
      </aside>
      <main class="admin-main">
        <header class="admin-topbar">
          <strong>{{ title }}</strong>
          <div class="user-info">
            <span class="admin-tag" :class="adminStore.isSuper ? 'primary' : 'info'">
              {{ adminStore.admin?.role === 'super_admin' ? '超级管理员' : '管理员' }}
            </span>
            <span>{{ adminStore.admin?.username }}</span>
            <button class="admin-btn ghost small" @click="onLogout">退出</button>
          </div>
        </header>
        <div class="admin-content">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
const adminStore = useAdminStore()
function onLogout() {
  adminStore.logout()
  navigateTo('/admin/login')
}
</script>

<style>
@import '~/assets/admin.css';
</style>
