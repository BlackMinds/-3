// 灵草分级系统数据

export interface HerbDef {
  id: string;
  name: string;
  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null;
  description: string;
  unlockPlotMaxLevel: number; // 解锁该灵草需要的灵田等级
}

export interface HerbQualityDef {
  id: string;
  name: string;
  color: string;
  multiplier: number;     // 品质倍率
  growMinutes: number;    // 成熟时间(分钟)
  baseYield: number;      // 基础产量(株)
  unlockPlotLevel: number; // 解锁该品质需要的灵田等级
}

// 灵草种类
export const HERBS: HerbDef[] = [
  { id: 'common_herb',  name: '灵草',   element: null,    description: '通用灵草,炼丹辅料',     unlockPlotMaxLevel: 1  },
  { id: 'metal_herb',   name: '锐金草', element: 'metal', description: '金系灵草,攻击系丹药主料', unlockPlotMaxLevel: 1  },
  { id: 'wood_herb',    name: '青木叶', element: 'wood',  description: '木系灵草,气血系丹药主料', unlockPlotMaxLevel: 1  },
  { id: 'water_herb',   name: '玄水苔', element: 'water', description: '水系灵草,防御系丹药主料', unlockPlotMaxLevel: 4  },
  { id: 'fire_herb',    name: '赤焰花', element: 'fire',  description: '火系灵草,暴击系丹药主料', unlockPlotMaxLevel: 4  },
  { id: 'earth_herb',   name: '厚土参', element: 'earth', description: '土系灵草,综合系丹药主料', unlockPlotMaxLevel: 7  },
  { id: 'spirit_grass', name: '仙灵草', element: null,    description: '突破丹药关键材料',       unlockPlotMaxLevel: 10 },
];

// 灵草品质
export const HERB_QUALITIES: HerbQualityDef[] = [
  { id: 'white',  name: '凡品', color: '#CCCCCC', multiplier: 1.00, growMinutes: 30,  baseYield: 3, unlockPlotLevel: 1  },
  { id: 'green',  name: '灵品', color: '#00CC00', multiplier: 1.20, growMinutes: 60,  baseYield: 3, unlockPlotLevel: 1  },
  { id: 'blue',   name: '玄品', color: '#0066FF', multiplier: 1.50, growMinutes: 120, baseYield: 4, unlockPlotLevel: 4  },
  { id: 'purple', name: '地品', color: '#9933FF', multiplier: 2.00, growMinutes: 240, baseYield: 4, unlockPlotLevel: 7  },
  { id: 'gold',   name: '天品', color: '#FFAA00', multiplier: 3.00, growMinutes: 480, baseYield: 5, unlockPlotLevel: 10 },
  { id: 'red',    name: '仙品', color: '#FF3333', multiplier: 5.00, growMinutes: 960, baseYield: 5, unlockPlotLevel: 13 },
];

// 灵田等级配置
export interface PlotLevelConfig {
  level: number;
  plotCount: number;     // 地块数
  maxQuality: string;    // 最高品质ID
}

export const PLOT_LEVEL_CONFIG: PlotLevelConfig[] = [
  { level: 1,  plotCount: 2, maxQuality: 'green'  },
  { level: 2,  plotCount: 2, maxQuality: 'green'  },
  { level: 3,  plotCount: 2, maxQuality: 'green'  },
  { level: 4,  plotCount: 3, maxQuality: 'blue'   },
  { level: 5,  plotCount: 3, maxQuality: 'blue'   },
  { level: 6,  plotCount: 3, maxQuality: 'blue'   },
  { level: 7,  plotCount: 4, maxQuality: 'purple' },
  { level: 8,  plotCount: 4, maxQuality: 'purple' },
  { level: 9,  plotCount: 4, maxQuality: 'purple' },
  { level: 10, plotCount: 5, maxQuality: 'gold'   },
  { level: 11, plotCount: 5, maxQuality: 'gold'   },
  { level: 12, plotCount: 5, maxQuality: 'gold'   },
  { level: 13, plotCount: 6, maxQuality: 'red'    },
  { level: 14, plotCount: 6, maxQuality: 'red'    },
  { level: 15, plotCount: 6, maxQuality: 'red'    },
];

export function getPlotConfig(level: number): PlotLevelConfig {
  if (level < 1) return { level: 0, plotCount: 0, maxQuality: 'white' };
  return PLOT_LEVEL_CONFIG[Math.min(level - 1, PLOT_LEVEL_CONFIG.length - 1)];
}

export function getHerbById(id: string): HerbDef | undefined {
  return HERBS.find(h => h.id === id);
}

export function getQualityById(id: string): HerbQualityDef | undefined {
  return HERB_QUALITIES.find(q => q.id === id);
}

export function getQualityIndex(id: string): number {
  return HERB_QUALITIES.findIndex(q => q.id === id);
}

// 检查品质是否在灵田等级允许范围内
export function isQualityUnlocked(qualityId: string, plotLevel: number): boolean {
  const q = getQualityById(qualityId);
  if (!q) return false;
  return plotLevel >= q.unlockPlotLevel;
}

// 检查灵草种类是否在灵田等级允许范围内
export function isHerbUnlocked(herbId: string, plotLevel: number): boolean {
  const h = getHerbById(herbId);
  if (!h) return false;
  return plotLevel >= h.unlockPlotMaxLevel;
}

// 计算品质系数(灵草加权平均)
export function calcQualityFactor(usedHerbs: { quality: string; count: number }[]): number {
  let totalCount = 0;
  let totalWeight = 0;
  for (const h of usedHerbs) {
    const q = getQualityById(h.quality);
    if (!q) continue;
    totalCount += h.count;
    totalWeight += q.multiplier * h.count;
  }
  if (totalCount === 0) return 1.0;
  return Math.round((totalWeight / totalCount) * 100) / 100;
}
