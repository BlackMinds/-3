// 客户端路由守卫：未登录跳回 /admin/login
export default defineNuxtRouteMiddleware((to) => {
  const adminStore = useAdminStore()
  if (!adminStore.isLoggedIn && to.path !== '/admin/login') {
    return navigateTo('/admin/login')
  }
})
