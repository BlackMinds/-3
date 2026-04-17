// 兼容层：原 sectItems.ts 已改名为 items.ts
// 保留本文件做向后兼容 re-export，避免破坏现有 import
export { SECT_ITEM_INFO, ITEM_INFO, ITEM_CATEGORIES } from './items';
export type { ItemInfo, ItemCategory } from './items';
