// 排行榜 / 秘境组队房间等列表里，特定角色名享有专属名片特效
// 在 SPECIAL_VARIANTS 加一行 → 排行榜 + 组队房间同时生效

export interface SpecialCardVariant {
  /** 卡片附加 class（驱动背景/流光/光环/名字渐变） */
  cardClass: string;
  /** 徽章文字（例如「剑魂」「影帝」） */
  badgeText: string;
  /** 徽章 class 名 */
  badgeClass: string;
  /** 装饰 emoji（如 ⚡ 🔬 🧟 🎵），可选 */
  decoration?: string;
  /** 装饰 emoji 的 class 名 */
  decorationClass?: string;
}

export const SPECIAL_VARIANTS: Record<string, SpecialCardVariant> = {
  // ───── 冷月剑魂同款（紫蓝） ─────
  '无心':       { cardClass: 'special-card', badgeText: '剑魂',       badgeClass: 'special-card-badge' },
  '陳太初':     { cardClass: 'special-card', badgeText: '太初道君',   badgeClass: 'special-card-badge' },
  '好运加载中': { cardClass: 'special-card', badgeText: '好事花生', badgeClass: 'special-card-badge' },
  '夷陵':       { cardClass: 'special-card', badgeText: '老祖',       badgeClass: 'special-card-badge' },
  '天生是怪人': { cardClass: 'special-card', badgeText: '天生是怪人', badgeClass: 'special-card-badge' },
  // ───── 影帝（彩虹） ─────
  '吴彦祖1号':  { cardClass: 'wuyanzu-card',  badgeText: '影帝',     badgeClass: 'wuyanzu-card-badge',  decoration: '⚡', decorationClass: 'wuyanzu-card-bolt' },
  // ───── 科研家（青蓝） ─────
  '魚魚魚':       { cardClass: 'yuyu-card',     badgeText: '科研家',   badgeClass: 'yuyu-card-badge',     decoration: '🔬', decorationClass: 'yuyu-card-bolt' },
  // ───── 姜尸头子（绿紫） ─────
  '僵尸仙人':   { cardClass: 'jiangshi-card', badgeText: '姜尸头子', badgeClass: 'jiangshi-card-badge', decoration: '🧟', decorationClass: 'jiangshi-card-bolt' },
  // ───── 小可爱（粉色胖丁） ─────
  '郭峰':       { cardClass: 'guofeng-card',  badgeText: '小可爱',   badgeClass: 'guofeng-card-badge',  decoration: '🎵', decorationClass: 'guofeng-card-music' },
};

export function getSpecialVariant(name: string | undefined | null): SpecialCardVariant | undefined {
  if (!name) return undefined;
  return SPECIAL_VARIANTS[name];
}

/** 兼容旧接口：仅冷月剑魂同款（紫蓝）的 5 个角色，pages/index.vue 在用 */
export const SPECIAL_BADGE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIAL_VARIANTS)
    .filter(([, v]) => v.cardClass === 'special-card')
    .map(([k, v]) => [k, v.badgeText]),
);
