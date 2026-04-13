<template>
  <div class="login-page">
    <!-- 背景层：云雾 + 远山 -->
    <div class="bg-layer">
      <div class="mountain mountain-far"></div>
      <div class="mountain mountain-mid"></div>
      <div class="mountain mountain-near"></div>
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="cloud cloud-3"></div>
      <div class="mist-band mist-1"></div>
      <div class="mist-band mist-2"></div>
    </div>

    <!-- 飘浮粒子（灵气） -->
    <div class="particles">
      <span v-for="i in 12" :key="i" class="particle" :style="particleStyle(i)"></span>
    </div>

    <!-- 登录卡片 -->
    <div class="login-card">
      <div class="card-ornament top-ornament">
        <svg viewBox="0 0 200 16" class="ornament-svg">
          <path d="M0,8 Q25,0 50,8 T100,8 T150,8 T200,8" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
          <circle cx="100" cy="8" r="2.5" fill="currentColor" opacity="0.3"/>
          <circle cx="70" cy="8" r="1.5" fill="currentColor" opacity="0.2"/>
          <circle cx="130" cy="8" r="1.5" fill="currentColor" opacity="0.2"/>
        </svg>
      </div>

      <h1 class="title">万界仙途</h1>
      <p class="subtitle">—— 一念入道，万界为途 ——</p>

      <div class="tabs">
        <button :class="['tab', { active: mode === 'login' }]" @click="switchMode('login')">入 界</button>
        <span class="tab-divider"></span>
        <button :class="['tab', { active: mode === 'register' }]" @click="switchMode('register')">开 辟</button>
      </div>

      <form @submit.prevent="handleSubmit" class="form">
        <div class="form-group">
          <label>道 号</label>
          <div class="input-wrap">
            <input v-model="username" type="text" placeholder="取一道号，踏入仙途" maxlength="16" autocomplete="username" />
            <div class="input-line"></div>
          </div>
        </div>

        <div class="form-group">
          <label>口 诀</label>
          <div class="input-wrap">
            <input v-model="password" type="password" placeholder="设一口诀，护道心安" maxlength="32" autocomplete="current-password" />
            <div class="input-line"></div>
          </div>
        </div>

        <transition name="fade-slide">
          <div v-if="mode === 'register'" class="form-group">
            <label>印 证</label>
            <div class="input-wrap">
              <input v-model="confirmPassword" type="password" placeholder="再述口诀，以作印证" maxlength="32" autocomplete="new-password" />
              <div class="input-line"></div>
            </div>
          </div>
        </transition>

        <transition name="fade">
          <p v-if="errorMsg" class="msg msg-error">{{ errorMsg }}</p>
        </transition>
        <transition name="fade">
          <p v-if="successMsg" class="msg msg-success">{{ successMsg }}</p>
        </transition>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span class="btn-text">
            {{ loading ? '凝神运气中…' : mode === 'login' ? '踏 入 仙 途' : '开 辟 道 途' }}
          </span>
          <span class="btn-glow"></span>
        </button>
      </form>

      <div class="card-ornament bottom-ornament">
        <svg viewBox="0 0 200 16" class="ornament-svg">
          <path d="M0,8 Q25,16 50,8 T100,8 T150,8 T200,8" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
        </svg>
      </div>
    </div>

    <p class="footer-verse">修仙之路，道阻且长</p>
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)

function switchMode(m: 'login' | 'register') {
  mode.value = m
  errorMsg.value = ''
  successMsg.value = ''
}

function particleStyle(i: number) {
  const left = 5 + ((i * 37) % 90)
  const delay = (i * 1.3) % 8
  const duration = 6 + (i % 5) * 2
  const size = 2 + (i % 3)
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    width: `${size}px`,
    height: `${size}px`,
  }
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!username.value || !password.value) {
    errorMsg.value = '道号与口诀不可为空'
    return
  }

  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    errorMsg.value = '两次口诀不一致'
    return
  }

  loading.value = true

  try {
    if (mode.value === 'register') {
      const res: any = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { username: username.value, password: password.value },
      })
      if (res.code === 200) {
        successMsg.value = '道途已开，请入界'
        mode.value = 'login'
        confirmPassword.value = ''
      } else {
        errorMsg.value = res.message
      }
    } else {
      const res: any = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username: username.value, password: password.value },
      })
      if (res.code === 200) {
        userStore.setLogin(res.data)
        navigateTo('/')
      } else {
        errorMsg.value = res.message
      }
    }
  } catch {
    errorMsg.value = '天道无应，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: linear-gradient(180deg, #161410 0%, #1e1c18 30%, #222018 60%, #161410 100%);
  overflow: hidden;
}
.bg-layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
.mountain { position: absolute; bottom: 0; width: 100%; }
.mountain-far { height: 35%; background: linear-gradient(180deg, transparent 0%, rgba(80,75,65,0.20) 20%, rgba(80,75,65,0.35) 100%); clip-path: polygon(0% 100%, 0% 65%, 8% 45%, 18% 55%, 28% 30%, 38% 50%, 48% 20%, 58% 45%, 68% 25%, 78% 48%, 88% 35%, 95% 50%, 100% 40%, 100% 100%); }
.mountain-mid { height: 28%; background: linear-gradient(180deg, transparent 0%, rgba(60,55,45,0.25) 30%, rgba(60,55,45,0.40) 100%); clip-path: polygon(0% 100%, 0% 70%, 12% 50%, 22% 65%, 35% 35%, 45% 55%, 55% 30%, 65% 50%, 75% 40%, 85% 55%, 100% 45%, 100% 100%); }
.mountain-near { height: 18%; background: linear-gradient(180deg, transparent 0%, rgba(45,40,32,0.30) 40%, rgba(45,40,32,0.50) 100%); clip-path: polygon(0% 100%, 0% 60%, 15% 40%, 30% 55%, 50% 30%, 70% 50%, 85% 35%, 100% 50%, 100% 100%); }
.cloud { position: absolute; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(200,190,170,0.08) 0%, rgba(200,190,170,0) 70%); animation: cloud-drift linear infinite; }
.cloud-1 { width: 500px; height: 100px; top: 20%; left: -200px; animation-duration: 40s; }
.cloud-2 { width: 400px; height: 80px; top: 35%; right: -150px; animation-duration: 55s; animation-direction: reverse; }
.cloud-3 { width: 600px; height: 90px; top: 50%; left: -250px; animation-duration: 70s; }
@keyframes cloud-drift { 0% { transform: translateX(0); } 100% { transform: translateX(calc(100vw + 600px)); } }
.mist-band { position: absolute; width: 100%; background: linear-gradient(90deg, transparent 0%, rgba(80,75,65,0.12) 30%, rgba(80,75,65,0.12) 70%, transparent 100%); animation: mist-float ease-in-out infinite; }
.mist-1 { height: 60px; bottom: 25%; animation-duration: 12s; }
.mist-2 { height: 40px; bottom: 35%; animation-duration: 18s; animation-delay: 3s; }
@keyframes mist-float { 0%, 100% { opacity: 0.3; transform: translateX(-3%); } 50% { opacity: 0.6; transform: translateX(3%); } }
.particles { position: fixed; inset: 0; pointer-events: none; }
.particle { position: absolute; bottom: -10px; border-radius: 50%; background: radial-gradient(circle, rgba(125,184,142,0.5) 0%, transparent 70%); animation: float-up ease-in-out infinite; }
@keyframes float-up { 0% { transform: translateY(0) scale(0); opacity: 0; } 10% { opacity: 0.8; transform: translateY(-5vh) scale(1); } 90% { opacity: 0.3; } 100% { transform: translateY(-100vh) scale(0.3); opacity: 0; } }
.login-card { position: relative; z-index: 10; width: 400px; padding: 44px 40px 36px; background: linear-gradient(180deg, rgba(35,32,26,0.85) 0%, rgba(28,26,20,0.92) 100%); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(184,154,90,0.12); border-radius: 4px; box-shadow: 0 8px 40px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03); }
.login-card::before { content: ''; position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; border: 1px solid rgba(184,154,90,0.08); border-radius: 2px; pointer-events: none; }
.card-ornament { display: flex; justify-content: center; color: var(--gold-ink); }
.ornament-svg { width: 160px; height: 16px; }
.top-ornament { margin-bottom: 8px; }
.bottom-ornament { margin-top: 20px; }
.title { text-align: center; font-family: 'ZCOOL XiaoWei', 'STKaiti', 'KaiTi', serif; font-size: 36px; font-weight: 400; color: var(--gold-ink); letter-spacing: 12px; margin: 0 0 6px 0; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }
.subtitle { text-align: center; font-size: 13px; color: var(--ink-light); letter-spacing: 4px; margin: 0 0 28px 0; font-weight: 300; }
.tabs { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 28px; }
.tab { flex: none; padding: 8px 28px; background: none; border: none; font-family: 'Noto Serif SC', serif; font-size: 14px; letter-spacing: 6px; color: var(--ink-light); cursor: pointer; transition: all 0.4s ease; position: relative; }
.tab::after { content: ''; position: absolute; bottom: 0; left: 50%; right: 50%; height: 1.5px; background: var(--gold-ink); transition: all 0.4s ease; }
.tab.active { color: var(--gold-light); }
.tab.active::after { left: 20%; right: 20%; }
.tab:hover:not(.active) { color: var(--ink-medium); }
.tab-divider { width: 1px; height: 16px; background: var(--ink-faint); opacity: 0.4; }
.form { display: flex; flex-direction: column; }
.form-group { margin-bottom: 22px; }
.form-group label { display: block; font-size: 12px; letter-spacing: 6px; color: var(--ink-light); margin-bottom: 8px; font-weight: 300; }
.input-wrap { position: relative; }
.input-wrap input { width: 100%; padding: 10px 0; background: transparent; border: none; border-bottom: 1px solid var(--ink-faint); color: #e0d8c8; font-family: 'Noto Serif SC', serif; font-size: 15px; outline: none; transition: border-color 0.3s; letter-spacing: 1px; }
.input-wrap input:focus { border-bottom-color: var(--gold-ink); }
.input-wrap input::placeholder { color: var(--ink-faint); font-size: 13px; letter-spacing: 2px; }
.input-line { position: absolute; bottom: 0; left: 50%; width: 0; height: 1.5px; background: linear-gradient(90deg, transparent, var(--gold-ink), transparent); transition: all 0.4s ease; transform: translateX(-50%); }
.input-wrap input:focus ~ .input-line { width: 100%; }
.msg { font-size: 13px; margin: 0 0 14px 0; text-align: center; letter-spacing: 1px; }
.msg-error { color: var(--cinnabar); }
.msg-success { color: var(--jade); }
.submit-btn { position: relative; width: 100%; padding: 13px 0; background: linear-gradient(135deg, rgba(107,158,125,0.12) 0%, rgba(107,158,125,0.06) 100%); border: 1px solid rgba(107,158,125,0.25); border-radius: 3px; cursor: pointer; overflow: hidden; transition: all 0.4s ease; margin-top: 4px; }
.btn-text { position: relative; z-index: 1; font-family: 'Noto Serif SC', serif; font-size: 15px; letter-spacing: 8px; color: var(--jade); font-weight: 400; transition: color 0.4s ease; }
.btn-glow { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(107,158,125,0.15) 0%, rgba(107,158,125,0.25) 50%, rgba(107,158,125,0.15) 100%); opacity: 0; transition: opacity 0.4s ease; }
.submit-btn:hover .btn-glow { opacity: 1; }
.submit-btn:hover .btn-text { color: var(--jade-light); }
.submit-btn:active { transform: scale(0.99); }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.submit-btn:disabled:hover .btn-glow { opacity: 0; }
.footer-verse { position: relative; z-index: 10; margin-top: 32px; font-size: 12px; color: var(--ink-light); letter-spacing: 6px; opacity: 0.5; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-slide-enter-active { transition: all 0.4s ease; }
.fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(-10px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(-10px); }
@media (max-width: 480px) {
  .login-card { width: calc(100vw - 32px); padding: 32px 24px 28px; }
  .title { font-size: 28px; letter-spacing: 8px; }
}
</style>
