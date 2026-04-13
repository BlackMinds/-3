import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const tokenCookie = useCookie('xiantu_token', { maxAge: 7 * 24 * 3600 })
  const usernameCookie = useCookie('xiantu_username', { maxAge: 7 * 24 * 3600 })
  const userIdCookie = useCookie<number>('xiantu_userId', { maxAge: 7 * 24 * 3600 })

  const token = ref(tokenCookie.value || '')
  const username = ref(usernameCookie.value || '')
  const userId = ref(userIdCookie.value || 0)

  const isLoggedIn = computed(() => !!token.value)

  function setLogin(data: { token: string; user: { id: number; username: string } }) {
    token.value = data.token
    username.value = data.user.username
    userId.value = data.user.id
    tokenCookie.value = data.token
    usernameCookie.value = data.user.username
    userIdCookie.value = data.user.id
  }

  function logout() {
    token.value = ''
    username.value = ''
    userId.value = 0
    tokenCookie.value = null
    usernameCookie.value = null
    userIdCookie.value = null
  }

  return { token, username, userId, isLoggedIn, setLogin, logout }
})
