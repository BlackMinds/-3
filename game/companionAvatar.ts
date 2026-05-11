// 30 张道侣 SVG 头像生成器（6 品质 × 5 性格）
// 占位方案：CSS 渐变 + 品质光晕 + 性格符字。后续可替换为真实立绘。

export type AvatarQuality = 0 | 1 | 2 | 3 | 4 | 5
export type AvatarPersonality = '冷艳' | '活泼' | '温柔' | '高傲' | '俏皮'

// 品质 → 边框/光晕色
const QUALITY_THEME: Record<AvatarQuality, { border: string; glow: string; rim: string }> = {
  0: { border: '#cfcfcf', glow: 'rgba(255,255,255,0.20)', rim: '#e8e8e8' },
  1: { border: '#5fcf6f', glow: 'rgba(95,207,111,0.40)', rim: '#80e890' },
  2: { border: '#5fa0e8', glow: 'rgba(95,160,232,0.45)', rim: '#8ac0f0' },
  3: { border: '#a35eef', glow: 'rgba(163,94,239,0.55)', rim: '#c87aff' },
  4: { border: '#ffaa33', glow: 'rgba(255,170,51,0.65)', rim: '#ffd366' },
  5: { border: '#ff4a5e', glow: 'rgba(255,74,94,0.75)', rim: '#ff8888' },
}

// 性格 → 背景渐变 + 性格符 + 主色调
const PERSONALITY_THEME: Record<AvatarPersonality, {
  bgFrom: string
  bgTo: string
  symbol: string  // 单字代表性格
  accent: string  // 文字色
  hairGradient: [string, string]
}> = {
  冷艳: { bgFrom: '#1e3a5f', bgTo: '#0a1a2e', symbol: '霜', accent: '#a3d9ff', hairGradient: ['#5a4a7a', '#2a1a3a'] },
  活泼: { bgFrom: '#ff8c5e', bgTo: '#c64b4b', symbol: '霞', accent: '#fff0c0', hairGradient: ['#ff7050', '#c93820'] },
  温柔: { bgFrom: '#ffb5d6', bgTo: '#c97aaf', symbol: '柔', accent: '#fff5f7', hairGradient: ['#a04a70', '#5a2540'] },
  高傲: { bgFrom: '#a87a35', bgTo: '#5a3f15', symbol: '凰', accent: '#ffe399', hairGradient: ['#7050a0', '#3a2050'] },
  俏皮: { bgFrom: '#80e890', bgTo: '#3a8a45', symbol: '灵', accent: '#fff8d8', hairGradient: ['#705030', '#3a2510'] },
}

// 生成 inline SVG（仅占位用，立绘后续替换）
export function generateCompanionAvatar(quality: AvatarQuality, personality: AvatarPersonality, size = 120): string {
  const q = QUALITY_THEME[quality]
  const p = PERSONALITY_THEME[personality]
  const id = `${quality}_${personality}`
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg_${id}" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${p.bgFrom}"/>
      <stop offset="100%" stop-color="${p.bgTo}"/>
    </radialGradient>
    <linearGradient id="hair_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.hairGradient[0]}"/>
      <stop offset="100%" stop-color="${p.hairGradient[1]}"/>
    </linearGradient>
    <radialGradient id="glow_${id}" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="${q.glow}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${q.glow}" stop-opacity="0.9"/>
    </radialGradient>
  </defs>

  <!-- 外圈品质光晕 -->
  <circle cx="60" cy="60" r="58" fill="url(#glow_${id})"/>
  <!-- 主圆背景 -->
  <circle cx="60" cy="60" r="54" fill="url(#bg_${id})"/>

  <!-- 头发剪影（顶部弧形） -->
  <path d="M 22 60 Q 22 25, 60 25 Q 98 25, 98 60 Q 98 50, 90 48 Q 82 30, 60 32 Q 38 30, 30 48 Q 22 50, 22 60 Z"
        fill="url(#hair_${id})" opacity="0.85"/>

  <!-- 脸部（半透明圆圈，给后续插画留位） -->
  <ellipse cx="60" cy="68" rx="20" ry="24" fill="#f4d4b3" opacity="0.55"/>

  <!-- 眼睛（简笔双月） -->
  <path d="M 50 64 Q 53 62 56 64" stroke="#3a1f2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M 64 64 Q 67 62 70 64" stroke="#3a1f2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>

  <!-- 嘴（极淡） -->
  <path d="M 56 78 Q 60 80 64 78" stroke="#a64a5a" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>

  <!-- 性格符（中央字） -->
  <text x="60" y="108" text-anchor="middle"
        font-size="14" font-family="'KaiTi','STKaiti',serif"
        fill="${p.accent}" opacity="0.85"
        style="text-shadow: 0 1px 3px rgba(0,0,0,0.6);">${p.symbol}</text>

  <!-- 外边框 -->
  <circle cx="60" cy="60" r="54" fill="none" stroke="${q.border}" stroke-width="3"/>
  <circle cx="60" cy="60" r="55" fill="none" stroke="${q.rim}" stroke-width="1" opacity="0.6"/>
</svg>`.trim()
}

// 把 SVG 转 data URL（用于 <img src>）
export function avatarDataUrl(quality: AvatarQuality, personality: AvatarPersonality, size = 120): string {
  const svg = generateCompanionAvatar(quality, personality, size)
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// 从 avatarId（"companion_4_3"）解析品质，配合性格生成 SVG
// 当前邂逅生成的 avatarId 是 `companion_<quality>_<seedIdx>`，性格单独存
export function parseAvatarId(avatarId: string): { quality: AvatarQuality; seed: number } {
  const m = /^companion_(\d+)_(\d+)$/.exec(avatarId)
  if (!m) return { quality: 0 as AvatarQuality, seed: 1 }
  return {
    quality: (Math.min(5, Math.max(0, parseInt(m[1], 10))) as AvatarQuality),
    seed: parseInt(m[2], 10) || 1,
  }
}

// ============================================================
// 子女头像（按性别 + 资质）
// ============================================================

export type ChildGender = 'male' | 'female'
export type ChildAptitude = 0 | 1 | 2 | 3 | 4 | 5 | 6

const APT_THEME: Record<ChildAptitude, { from: string; to: string; rim: string; glow: string }> = {
  0: { from: '#a8a8a8', to: '#7a7a7a', rim: '#cfcfcf', glow: 'rgba(255,255,255,0.20)' },
  1: { from: '#5fcf6f', to: '#357a3d', rim: '#80e890', glow: 'rgba(95,207,111,0.40)' },
  2: { from: '#5fa0e8', to: '#2a608a', rim: '#8ac0f0', glow: 'rgba(95,160,232,0.45)' },
  3: { from: '#a35eef', to: '#5a2585', rim: '#c87aff', glow: 'rgba(163,94,239,0.55)' },
  4: { from: '#ffaa33', to: '#aa6010', rim: '#ffd366', glow: 'rgba(255,170,51,0.65)' },
  5: { from: '#ff4a5e', to: '#a00020', rim: '#ff8888', glow: 'rgba(255,74,94,0.75)' },
  6: { from: '#fff0a5', to: '#ffaa33', rim: '#ffffaa', glow: 'rgba(255,240,165,0.85)' },  // 圣品 双层光
}

export function generateChildAvatar(gender: ChildGender, aptitude: ChildAptitude, size = 100): string {
  const t = APT_THEME[aptitude]
  const id = `${gender}_${aptitude}`
  const symbol = gender === 'male' ? '少' : '幼'
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg_c_${id}" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="${t.from}"/>
      <stop offset="100%" stop-color="${t.to}"/>
    </radialGradient>
    <radialGradient id="glow_c_${id}" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="${t.glow}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${t.glow}" stop-opacity="0.9"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#glow_c_${id})"/>
  <circle cx="50" cy="50" r="44" fill="url(#bg_c_${id})"/>
  <!-- 童脸 -->
  <ellipse cx="50" cy="55" rx="18" ry="20" fill="#f4d4b3" opacity="0.8"/>
  <!-- 双髻（女）/ 短发（男）-->
  ${gender === 'female'
    ? `<circle cx="36" cy="34" r="6" fill="${t.from}"/><circle cx="64" cy="34" r="6" fill="${t.from}"/>`
    : `<path d="M 30 38 Q 50 22, 70 38 L 70 50 Q 50 40, 30 50 Z" fill="${t.from}"/>`
  }
  <!-- 大眼睛（萌） -->
  <circle cx="42" cy="52" r="2.5" fill="#3a1f2a"/>
  <circle cx="58" cy="52" r="2.5" fill="#3a1f2a"/>
  <!-- 小嘴 -->
  <path d="M 46 66 Q 50 68 54 66" stroke="#a64a5a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <!-- 资质字 -->
  <text x="50" y="92" text-anchor="middle"
        font-size="11" font-family="'KaiTi','STKaiti',serif"
        fill="${t.rim}" opacity="0.8">${symbol}</text>
  <circle cx="50" cy="50" r="44" fill="none" stroke="${t.rim}" stroke-width="2"/>
</svg>`.trim()
}

export function childAvatarDataUrl(gender: ChildGender, aptitude: ChildAptitude, size = 100): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(generateChildAvatar(gender, aptitude, size))
}
