import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '');
  const username = ref(localStorage.getItem('username') || '');
  const userId = ref(Number(localStorage.getItem('userId')) || 0);

  function setLogin(data: { token: string; user: { id: number; username: string } }) {
    token.value = data.token;
    username.value = data.user.username;
    userId.value = data.user.id;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.user.username);
    localStorage.setItem('userId', String(data.user.id));
  }

  function logout() {
    token.value = '';
    username.value = '';
    userId.value = 0;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
  }

  const isLoggedIn = () => !!token.value;

  return { token, username, userId, setLogin, logout, isLoggedIn };
});
