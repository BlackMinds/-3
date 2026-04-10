import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
    },
    {
      path: '/create',
      name: 'CreateCharacter',
      component: () => import('../views/CreateCharacter.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      name: 'Game',
      component: () => import('../views/Game.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/');
  } else {
    next();
  }
});

export default router;
