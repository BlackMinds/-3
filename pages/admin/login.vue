<template>
  <div class="admin-app">
    <div class="admin-login-bg">
      <form class="admin-login-card" @submit.prevent="onSubmit">
        <h1>仙途后台</h1>
        <p class="sub">管理员登录</p>

        <div class="admin-form-row">
          <label class="admin-label">账号</label>
          <input v-model="username" class="admin-input" autocomplete="username" placeholder="管理员账号" />
        </div>
        <div class="admin-form-row">
          <label class="admin-label">密码</label>
          <input v-model="password" type="password" class="admin-input" autocomplete="current-password" placeholder="密码" />
        </div>

        <p v-if="error" class="text-danger admin-mb-sm">{{ error }}</p>

        <button class="admin-btn" type="submit" :disabled="loading" style="width: 100%; justify-content: center;">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const adminStore = useAdminStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// 已登录则直接跳概览
if (adminStore.isLoggedIn) {
  navigateTo('/admin/dashboard')
}

async function onSubmit() {
  if (!username.value || !password.value) {
    error.value = '请填写账号和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<any>('/api/admin/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    if (res.code === 200) {
      adminStore.setLogin(res.data)
      navigateTo('/admin/dashboard')
    } else {
      error.value = res.message || '登录失败'
    }
  } catch (e: any) {
    error.value = e?.data?.message || '网络异常'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import '~/assets/admin.css';
</style>
