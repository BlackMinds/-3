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
      const status = error?.response?.status ?? error?.statusCode
      const data = error?.response?._data ?? error?.data
      if (status === 503 && data?.maintenance) {
        navigateTo('/maintenance')
        throw error
      }
      if (status === 401) {
        userStore.logout()
        navigateTo('/login')
      }
      throw error
    }
  }

  return api
}
