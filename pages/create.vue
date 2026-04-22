<template>
  <div class="create-page">
    <div class="bg-particles">
      <span v-for="i in 20" :key="i" class="bg-particle" :style="bgParticleStyle(i)"></span>
    </div>

    <div class="step-indicator">
      <span :class="['step-dot', { active: step >= 1 }]"></span>
      <span class="step-line" :class="{ filled: step >= 2 }"></span>
      <span :class="['step-dot', { active: step >= 2 }]"></span>
      <span class="step-line" :class="{ filled: step >= 3 }"></span>
      <span :class="['step-dot', { active: step >= 3 }]"></span>
    </div>

    <transition name="page-fade" mode="out-in">
      <!-- Step 1: 选择灵根 -->
      <div v-if="step === 1" key="step1" class="step-content">
        <h1 class="main-title">感悟天地，觉醒灵根</h1>
        <p class="main-sub">灵根乃修行之本，五行各有造化</p>

        <div class="root-grid">
          <div v-for="root in roots" :key="root.id" :class="['root-card', { selected: selectedRoot === root.id }]" @click="selectRoot(root.id)">
            <div class="root-orb" :style="{ '--root-color': root.color, '--root-glow': root.glow }">
              <div class="orb-ring ring-1"></div>
              <div class="orb-ring ring-2"></div>
              <div class="orb-core"><span class="orb-char">{{ root.char }}</span></div>
              <span v-for="j in 6" :key="j" class="orb-particle" :style="orbParticleStyle(j, root.color)"></span>
            </div>
            <h3 class="root-name">{{ root.name }}</h3>
            <p class="root-desc">{{ root.desc }}</p>
            <div class="root-tags"><span class="tag" v-for="tag in root.tags" :key="tag">{{ tag }}</span></div>
            <transition name="check-pop">
              <div v-if="selectedRoot === root.id" class="selected-mark">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
              </div>
            </transition>
          </div>
        </div>

        <transition name="fade-up">
          <div v-if="selectedRoot" class="root-detail">
            <div class="detail-inner">
              <div class="detail-stats">
                <div class="stat-item" v-for="stat in currentRootStats" :key="stat.label">
                  <span class="stat-label">{{ stat.label }}</span>
                  <div class="stat-bar-wrap"><div class="stat-bar" :style="{ width: stat.percent + '%', background: currentRoot?.color }"></div></div>
                  <span class="stat-value">{{ stat.value }}</span>
                </div>
              </div>
              <p class="detail-lore">{{ currentRoot?.lore }}</p>
            </div>
          </div>
        </transition>

        <button class="next-btn" :disabled="!selectedRoot" @click="step = 2">
          <span class="btn-text">感悟完毕，取道号</span>
        </button>
      </div>

      <!-- Step 2: 输入道号 -->
      <div v-else-if="step === 2" key="step2" class="step-content">
        <h1 class="main-title">取一道号，铭刻天道</h1>
        <p class="main-sub">道号将伴随你的修仙之路</p>
        <div class="chosen-root-display">
          <div class="chosen-orb" :style="{ '--root-color': currentRoot?.color, '--root-glow': currentRoot?.glow }"><span class="chosen-char">{{ currentRoot?.char }}</span></div>
          <span class="chosen-label">{{ currentRoot?.name }}</span>
        </div>
        <div class="name-input-area">
          <div class="name-input-wrap">
            <input v-model="characterName" type="text" placeholder="请赐道号（2-8字）" maxlength="8" class="name-input" @keyup.enter="handleCreate" />
            <div class="name-input-line"></div>
          </div>
          <p class="name-hint">道号一经铭刻，不可更改</p>
        </div>
        <transition name="fade"><p v-if="errorMsg" class="msg msg-error">{{ errorMsg }}</p></transition>
        <transition name="fade"><p v-if="successMsg" class="msg msg-success">{{ successMsg }}</p></transition>
        <div class="step2-btns">
          <button class="back-btn" @click="step = 1"><span>返回选灵根</span></button>
          <button class="next-btn" :disabled="!characterName || loading" @click="handleCreate">
            <span class="btn-text">{{ loading ? '天道铭刻中…' : '踏入仙途' }}</span>
          </button>
        </div>
      </div>

      <!-- Step 3: 创建成功 -->
      <div v-else-if="step === 3" key="step3" class="step-content success-step">
        <div class="success-orb-wrap">
          <div class="success-burst"></div>
          <div class="success-orb" :style="{ '--root-color': currentRoot?.color, '--root-glow': currentRoot?.glow }">
            <div class="success-ring"></div>
            <span class="success-char">{{ currentRoot?.char }}</span>
          </div>
        </div>
        <h1 class="success-title">灵根觉醒，道途已开</h1>
        <p class="success-name">{{ characterName }}</p>
        <p class="success-info">{{ currentRoot?.name }} · 练气一层</p>
        <button class="next-btn enter-btn" @click="enterGame"><span class="btn-text">进入万界</span></button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()

const step = ref(1)
const selectedRoot = ref('')
const characterName = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)

const roots = [
  { id: 'metal', name: '金灵根', char: '金', color: '#c9a85c', glow: 'rgba(201,168,92,0.3)', desc: '锐利无双，攻伐之道', lore: '金主杀伐，天生灵力攻击极高。修炼金系功法可附带流血与眩晕，乃攻击型修士的不二之选。', tags: ['攻击+15%', '金抗+15%', '暴力输出'], stats: { hp: 500, atk: 58, def: 30, spd: 50 } },
  { id: 'wood', name: '木灵根', char: '木', color: '#6baa7d', glow: 'rgba(107,170,125,0.3)', desc: '生生不息，长青之体', lore: '木主生机，气血充沛恢复力强。修炼木系功法可中毒与束缚敌人，同时持续回复自身，久战不衰。', tags: ['气血+15%', '木抗+15%', '持久吸血'], stats: { hp: 575, atk: 50, def: 30, spd: 50 } },
  { id: 'water', name: '水灵根', char: '水', color: '#5b8eaa', glow: 'rgba(91,142,170,0.3)', desc: '至柔至坚，万法归流', lore: '水主防御与控制，灵力防御天生出众。修炼水系功法可冻结与减速敌人，攻守兼备，以柔克刚。', tags: ['防御+15%', '水抗+15%', '控制冻结'], stats: { hp: 500, atk: 50, def: 35, spd: 50 } },
  { id: 'fire', name: '火灵根', char: '火', color: '#c45c4a', glow: 'rgba(196,92,74,0.3)', desc: '烈焰焚天，一击制敌', lore: '火主爆发，暴击伤害极为恐怖。修炼火系功法可灼烧敌人持续掉血，瞬间爆发力冠绝五行。', tags: ['暴伤+20%', '火抗+15%', '暴击灼烧'], stats: { hp: 500, atk: 50, def: 30, spd: 50 } },
  { id: 'earth', name: '土灵根', char: '土', color: '#a08a60', glow: 'rgba(160,138,96,0.3)', desc: '厚德载物，不动如山', lore: '土主坚韧，防御与气血均有加成。修炼土系功法可施加脆弱削弱敌人，自身坚如磐石，难以击破。', tags: ['防御+10%', '气血+10%', '土抗+15%'], stats: { hp: 550, atk: 50, def: 33, spd: 50 } },
]

const currentRoot = computed(() => roots.find((r) => r.id === selectedRoot.value))

const currentRootStats = computed(() => {
  const r = currentRoot.value
  if (!r) return []
  const max = { hp: 600, atk: 60, def: 40, spd: 55 }
  return [
    { label: '气血', value: r.stats.hp, percent: (r.stats.hp / max.hp) * 100 },
    { label: '攻击', value: r.stats.atk, percent: (r.stats.atk / max.atk) * 100 },
    { label: '防御', value: r.stats.def, percent: (r.stats.def / max.def) * 100 },
    { label: '身法', value: r.stats.spd, percent: (r.stats.spd / max.spd) * 100 },
  ]
})

function selectRoot(id: string) { selectedRoot.value = id }

function bgParticleStyle(i: number) {
  return { left: `${(i * 47 + 13) % 100}%`, animationDelay: `${(i * 0.8) % 10}s`, animationDuration: `${8 + (i % 6) * 2}s`, width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`, opacity: 0.3 + (i % 4) * 0.1 }
}

function orbParticleStyle(j: number, color: string) {
  return { '--angle': `${j * 60}deg`, '--radius': `${28 + (j % 3) * 6}px`, '--color': color, animationDelay: `${j * 0.4}s` }
}

async function handleCreate() {
  errorMsg.value = ''
  if (!characterName.value) { errorMsg.value = '请输入道号'; return }
  if (characterName.value.length < 2) { errorMsg.value = '道号至少2个字'; return }
  loading.value = true
  try {
    const res: any = await api('/character/create', { method: 'POST', body: { name: characterName.value, spiritual_root: selectedRoot.value } })
    if (res.code === 200) { step.value = 3 } else { errorMsg.value = res.message }
  } catch { errorMsg.value = '天道无应，请稍后再试' } finally { loading.value = false }
}

function enterGame() { navigateTo('/') }
</script>

<style scoped>
.create-page { min-height: 100vh; background: var(--paper); display: flex; flex-direction: column; align-items: center; padding: 40px 20px 60px; position: relative; overflow: hidden; }
.bg-particles { position: fixed; inset: 0; pointer-events: none; }
.bg-particle { position: absolute; bottom: -10px; border-radius: 50%; background: radial-gradient(circle, rgba(201,168,92,0.4) 0%, transparent 70%); animation: bg-float ease-in-out infinite; }
@keyframes bg-float { 0% { transform: translateY(0) scale(0); opacity: 0; } 10% { opacity: 0.6; transform: translateY(-5vh) scale(1); } 90% { opacity: 0.1; } 100% { transform: translateY(-100vh) scale(0.2); opacity: 0; } }
.step-indicator { display: flex; align-items: center; gap: 0; margin-bottom: 36px; z-index: 10; }
.step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ink-faint); transition: all 0.5s ease; }
.step-dot.active { background: var(--gold-ink); box-shadow: 0 0 12px rgba(212,180,106,0.4); }
.step-line { width: 60px; height: 1px; background: var(--ink-faint); transition: background 0.5s ease; }
.step-line.filled { background: var(--gold-ink); }
.main-title { text-align: center; font-family: 'ZCOOL XiaoWei', 'STKaiti', serif; font-size: 28px; font-weight: 400; color: var(--gold-ink); letter-spacing: 6px; margin: 0 0 8px 0; z-index: 10; }
.main-sub { text-align: center; font-size: 13px; color: var(--ink-light); letter-spacing: 3px; margin: 0 0 36px 0; z-index: 10; }
.root-grid { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; z-index: 10; margin-bottom: 24px; }
.root-card { position: relative; width: 155px; padding: 24px 14px 18px; background: rgba(40,36,30,0.7); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; text-align: center; cursor: pointer; transition: all 0.4s ease; overflow: hidden; }
.root-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 30%, var(--root-glow, transparent), transparent 70%); opacity: 0; transition: opacity 0.4s ease; pointer-events: none; }
.root-card:hover { border-color: rgba(255,255,255,0.08); transform: translateY(-4px); }
.root-card:hover::before { opacity: 0.5; }
.root-card.selected { border-color: var(--gold-ink); box-shadow: 0 0 24px rgba(212,180,106,0.15), inset 0 0 20px rgba(212,180,106,0.03); }
.root-card.selected::before { opacity: 1; }
.root-orb { position: relative; width: 70px; height: 70px; margin: 0 auto 14px; }
.orb-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid var(--root-color); opacity: 0.2; }
.ring-1 { animation: ring-spin 8s linear infinite; }
.ring-2 { inset: -6px; opacity: 0.1; animation: ring-spin 12s linear infinite reverse; }
@keyframes ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.orb-core { position: absolute; inset: 10px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, var(--root-color), transparent 70%); opacity: 0.25; display: flex; align-items: center; justify-content: center; }
.orb-char { font-family: 'ZCOOL XiaoWei', serif; font-size: 22px; color: var(--root-color); opacity: 0.9; text-shadow: 0 0 12px var(--root-glow); position: relative; z-index: 1; }
.root-card.selected .orb-core { opacity: 0.5; animation: orb-pulse 2s ease-in-out infinite; }
.root-card.selected .orb-char { opacity: 1; text-shadow: 0 0 20px var(--root-glow); }
@keyframes orb-pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.08); opacity: 0.7; } }
.orb-particle { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: var(--color); top: 50%; left: 50%; opacity: 0; animation: orb-orbit 3s ease-in-out infinite; }
@keyframes orb-orbit { 0% { transform: rotate(var(--angle)) translateX(var(--radius)) scale(0); opacity: 0; } 30% { opacity: 0.7; transform: rotate(calc(var(--angle) + 60deg)) translateX(var(--radius)) scale(1); } 100% { transform: rotate(calc(var(--angle) + 180deg)) translateX(calc(var(--radius) + 10px)) scale(0); opacity: 0; } }
.root-card:not(.selected) .orb-particle { animation-play-state: paused; opacity: 0; }
.root-name { font-family: 'Noto Serif SC', serif; font-size: 15px; color: #d8ceb8; letter-spacing: 4px; margin: 0 0 6px 0; font-weight: 400; }
.root-desc { font-size: 11px; color: var(--ink-light); letter-spacing: 1px; margin: 0 0 10px 0; }
.root-tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.tag { font-size: 10px; padding: 2px 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; color: var(--ink-light); letter-spacing: 0.5px; }
.selected-mark { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: var(--gold-ink); display: flex; align-items: center; justify-content: center; color: var(--paper); }
.root-detail { z-index: 10; width: 100%; max-width: 500px; margin-bottom: 24px; }
.detail-inner { padding: 20px 24px; background: rgba(40,36,30,0.6); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; }
.detail-stats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.stat-item { display: flex; align-items: center; gap: 10px; }
.stat-label { width: 36px; font-size: 12px; color: var(--ink-light); letter-spacing: 2px; text-align: right; }
.stat-bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
.stat-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; opacity: 0.7; }
.stat-value { width: 30px; font-size: 12px; color: #d8ceb8; text-align: right; }
.detail-lore { font-size: 12px; color: var(--ink-light); line-height: 1.8; letter-spacing: 0.5px; }
.chosen-root-display { display: flex; align-items: center; gap: 12px; margin-bottom: 36px; z-index: 10; }
.chosen-orb { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--root-color); display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, var(--root-glow), transparent 70%); animation: orb-pulse 3s ease-in-out infinite; }
.chosen-char { font-family: 'ZCOOL XiaoWei', serif; font-size: 18px; color: var(--root-color); text-shadow: 0 0 10px var(--root-glow); }
.chosen-label { font-size: 16px; color: #d8ceb8; letter-spacing: 4px; }
.name-input-area { z-index: 10; width: 320px; margin-bottom: 24px; }
.name-input-wrap { position: relative; }
.name-input { width: 100%; padding: 14px 0; background: transparent; border: none; border-bottom: 1px solid var(--ink-faint); color: #e0d8c8; font-family: 'Noto Serif SC', serif; font-size: 18px; text-align: center; letter-spacing: 6px; outline: none; transition: border-color 0.3s; }
.name-input:focus { border-bottom-color: var(--gold-ink); }
.name-input::placeholder { color: var(--ink-faint); font-size: 14px; letter-spacing: 3px; }
.name-input-line { position: absolute; bottom: 0; left: 50%; width: 0; height: 1.5px; background: linear-gradient(90deg, transparent, var(--gold-ink), transparent); transition: all 0.4s ease; transform: translateX(-50%); }
.name-input:focus ~ .name-input-line { width: 100%; }
.name-hint { text-align: center; font-size: 11px; color: var(--ink-faint); margin-top: 8px; letter-spacing: 1px; }
.step2-btns { display: flex; gap: 16px; z-index: 10; }
.back-btn { padding: 12px 28px; background: transparent; border: 1px solid var(--ink-faint); border-radius: 3px; font-family: 'Noto Serif SC', serif; font-size: 14px; letter-spacing: 3px; color: var(--ink-light); cursor: pointer; transition: all 0.3s ease; }
.back-btn:hover { border-color: var(--ink-light); color: #d8ceb8; }
.success-step { align-items: center; }
.success-orb-wrap { position: relative; width: 120px; height: 120px; margin-bottom: 32px; z-index: 10; }
.success-burst { position: absolute; inset: -30px; border-radius: 50%; background: radial-gradient(circle, var(--root-glow), transparent 60%); animation: burst-expand 2s ease-out forwards; }
@keyframes burst-expand { 0% { transform: scale(0); opacity: 1; } 60% { transform: scale(1.5); opacity: 0.4; } 100% { transform: scale(2); opacity: 0; } }
.success-orb { position: absolute; inset: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 40% 35%, var(--root-color), transparent 70%); opacity: 0; animation: success-appear 0.8s 0.3s ease-out forwards; }
@keyframes success-appear { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 0.4; } }
.success-ring { position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid var(--root-color); opacity: 0.3; animation: ring-spin 6s linear infinite; }
.success-char { font-family: 'ZCOOL XiaoWei', serif; font-size: 36px; color: var(--root-color); text-shadow: 0 0 24px var(--root-glow); position: relative; z-index: 1; opacity: 0; animation: char-appear 0.6s 0.8s ease-out forwards; }
@keyframes char-appear { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
.success-title { font-family: 'ZCOOL XiaoWei', serif; font-size: 24px; color: var(--gold-ink); letter-spacing: 6px; margin: 0 0 12px 0; z-index: 10; opacity: 0; animation: fade-in-up 0.6s 1s ease-out forwards; }
.success-name { font-size: 20px; color: #e0d8c8; letter-spacing: 8px; margin: 0 0 6px 0; z-index: 10; opacity: 0; animation: fade-in-up 0.6s 1.2s ease-out forwards; }
.success-info { font-size: 13px; color: var(--ink-light); letter-spacing: 3px; margin: 0 0 36px 0; z-index: 10; opacity: 0; animation: fade-in-up 0.6s 1.4s ease-out forwards; }
.enter-btn { opacity: 0; animation: fade-in-up 0.6s 1.6s ease-out forwards; }
@keyframes fade-in-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
.next-btn { position: relative; padding: 13px 48px; background: linear-gradient(135deg, rgba(142,202,160,0.10) 0%, rgba(142,202,160,0.05) 100%); border: 1px solid rgba(142,202,160,0.25); border-radius: 3px; cursor: pointer; transition: all 0.4s ease; z-index: 10; }
.next-btn .btn-text { font-family: 'Noto Serif SC', serif; font-size: 15px; letter-spacing: 6px; color: var(--jade); transition: color 0.3s ease; }
.next-btn:hover { background: linear-gradient(135deg, rgba(142,202,160,0.18) 0%, rgba(142,202,160,0.10) 100%); box-shadow: 0 0 20px rgba(142,202,160,0.1); }
.next-btn:hover .btn-text { color: var(--jade-light); }
.next-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.next-btn:disabled:hover { background: linear-gradient(135deg, rgba(142,202,160,0.10) 0%, rgba(142,202,160,0.05) 100%); box-shadow: none; }
.msg { font-size: 13px; text-align: center; letter-spacing: 1px; margin-bottom: 16px; z-index: 10; }
.msg-error { color: var(--cinnabar); }
.msg-success { color: var(--jade); }
.step-content { display: flex; flex-direction: column; align-items: center; z-index: 10; width: 100%; }
.page-fade-enter-active { transition: all 0.5s ease; }
.page-fade-leave-active { transition: all 0.3s ease; }
.page-fade-enter-from { opacity: 0; transform: translateX(30px); }
.page-fade-leave-to { opacity: 0; transform: translateX(-30px); }
.fade-up-enter-active { transition: all 0.5s ease; }
.fade-up-leave-active { transition: all 0.3s ease; }
.fade-up-enter-from { opacity: 0; transform: translateY(20px); }
.fade-up-leave-to { opacity: 0; transform: translateY(-10px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.check-pop-enter-active { transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.check-pop-leave-active { transition: all 0.2s ease; }
.check-pop-enter-from, .check-pop-leave-to { opacity: 0; transform: scale(0); }
@media (max-width: 860px) { .root-grid { max-width: 360px; } .root-card { width: calc(50% - 8px); } }
@media (max-width: 768px) {
  .create-page { padding: 24px 12px 40px; min-height: 100dvh; }
  .step-indicator { margin-bottom: 24px; }
  .step-line { width: 40px; }
  .main-title { font-size: 22px; letter-spacing: 4px; }
  .main-sub { font-size: 12px; letter-spacing: 2px; margin-bottom: 24px; }
  .root-card { padding: 18px 10px 14px; }
  .root-orb { width: 58px; height: 58px; }
  .orb-char { font-size: 18px; }
  .root-name { font-size: 14px; letter-spacing: 2px; }
  .root-desc { font-size: 11px; letter-spacing: 0.5px; }
  .tag { font-size: 10px; }
  .detail-inner { padding: 14px 16px; }
  .detail-lore { font-size: 11px; line-height: 1.7; }
  .name-input-area { width: min(320px, calc(100vw - 32px)); }
  .name-input { font-size: 16px; letter-spacing: 4px; }
  .step2-btns { flex-wrap: wrap; gap: 10px; justify-content: center; }
  .back-btn, .next-btn { padding: 10px 24px; font-size: 13px; letter-spacing: 3px; }
  .next-btn .btn-text { font-size: 13px; letter-spacing: 4px; }
  .chosen-root-display { margin-bottom: 24px; }
  .success-title { font-size: 20px; letter-spacing: 4px; }
  .success-name { font-size: 17px; letter-spacing: 6px; }
  .success-info { font-size: 12px; margin-bottom: 24px; }
}
@media (max-width: 480px) { .root-card { width: 100%; } .main-title { font-size: 20px; } }
</style>
