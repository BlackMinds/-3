import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAdminStore = defineStore('admin', () => {
  const tokenCookie = useCookie('xiantu_admin_token', { maxAge: 7 * 24 * 3600 })
  const adminCookie = useCookie<{ id: number; username: string; role: string } | null>('xiantu_admin_info', {
    maxAge: 7 * 24 * 3600,
  })

  const token = ref(tokenCookie.value || '')
  const admin = ref(adminCookie.value || null)

  const isLoggedIn = computed(() => !!token.value)
  const isSuper = computed(() => admin.value?.role === 'super_admin')

  function setLogin(data: { token: string; admin: { id: number; username: string; role: string } }) {
    token.value = data.token
    admin.value = data.admin
    tokenCookie.value = data.token
    adminCookie.value = data.admin
  }

  function logout() {
    token.value = ''
    admin.value = null
    tokenCookie.value = null
    adminCookie.value = null
  }

  return { token, admin, isLoggedIn, isSuper, setLogin, logout }
})
