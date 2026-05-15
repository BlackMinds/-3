// admin API 调用封装：自动携带 admin token，401 时跳回 /admin/login
export function useAdminApi() {
  const adminStore = useAdminStore()

  async function api<T = any>(url: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers }
    if (adminStore.token) {
      headers.Authorization = `Bearer ${adminStore.token}`
    }
    try {
      return await $fetch<T>(url, {
        baseURL: '/api',
        ...options,
        headers,
      })
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.statusCode === 401) {
        adminStore.logout()
        navigateTo('/admin/login')
      }
      throw error
    }
  }

  return api
}
