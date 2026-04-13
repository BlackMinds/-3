export function useApi() {
  const userStore = useUserStore()

  async function api<T = any>(url: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers }
    if (userStore.token) {
      headers.Authorization = `Bearer ${userStore.token}`
    }

    try {
      return await $fetch<T>(url, {
        baseURL: '/api',
        ...options,
        headers,
      })
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.statusCode === 401) {
        userStore.logout()
        navigateTo('/login')
      }
      throw error
    }
  }

  return api
}
