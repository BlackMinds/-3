/**
 * 典型 build preset — 对应各 tier 的"合理毕业档"
 * 用来快速模拟 v3.0 设计意图是否达成
 */

import type { PlayerBuild } from './sim-build-player'

export const PRESETS: Record<string, { name: string; build: PlayerBuild; element?: string }> = {
  'T1_early': {
    name: 'T1 前期(练气)',
    build: {
      level: 10, realmTier: 1, realmStage: 5,
      equipTier: 1, equipRarity: 'green', enhanceLevel: 0,
      weaponType: 'sword', skillLevel: 0,
    },
    element: 'metal',
  },
  'T3_mid': {
    name: 'T3 中期(金丹)',
    build: {
      level: 45, realmTier: 3, realmStage: 3,
      equipTier: 3, equipRarity: 'blue', enhanceLevel: 3,
      weaponType: 'sword', skillLevel: 2,
    },
    element: 'metal',
  },
  'T5_mid': {
    name: 'T5 中档(化神,紫装)',
    build: {
      level: 100, realmTier: 5, realmStage: 5,
      equipTier: 5, equipRarity: 'purple', enhanceLevel: 5,
      weaponType: 'sword', skillLevel: 3,
      awakenRarity: 'blue', pillFull: true,
    },
    element: 'metal',
  },
  'T7_late': {
    name: 'T7 中后期(大乘,金装)',
    build: {
      level: 150, realmTier: 7, realmStage: 3,
      equipTier: 7, equipRarity: 'gold', enhanceLevel: 7,
      weaponType: 'blade', skillLevel: 4,
      awakenRarity: 'purple', pillFull: true,
    },
    element: 'metal',
  },
  'T10_final': {
    name: 'T10 毕业(红装满强化)',
    build: {
      level: 200, realmTier: 8, realmStage: 10,
      equipTier: 10, equipRarity: 'red', enhanceLevel: 10,
      weaponType: 'blade', skillLevel: 5,
      awakenRarity: 'red', pillFull: true,
    },
    element: 'metal',
  },
  'T10_godlike': {
    name: 'T10 神器 build(全部拉满)',
    build: {
      level: 200, realmTier: 8, realmStage: 10,
      equipTier: 10, equipRarity: 'red', enhanceLevel: 10,
      weaponType: 'blade', skillLevel: 5,
      awakenRarity: 'red', pillFull: true,
    },
    element: 'metal',
  },
}
