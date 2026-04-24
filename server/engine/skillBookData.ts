// 功法书静态数据 - P1 MVP
// 书 = 3 类型 × 6 品质 × 6 元素倾向 = 108 SKU
// 书只是空壳容器，效果完全由镶嵌的石头决定

import type { SkillBook, Rarity, Element, SkillType } from '../../shared/stoneTypes'

const RARITIES: Rarity[] = ['white', 'green', 'blue', 'purple', 'gold', 'red']
const ELEMENTS: (Exclude<Element, null> | 'none')[] = ['metal', 'wood', 'water', 'fire', 'earth', 'none']
const SKILL_TYPES: SkillType[] = ['active', 'divine', 'passive']

const RARITY_NAME: Record<Rarity, string> = {
  white: '凡品', green: '灵品', blue: '玄品', purple: '地品', gold: '天品', red: '仙品',
}

const ELEMENT_NAME: Record<string, string> = {
  metal: '金', wood: '木', water: '水', fire: '火', earth: '土', none: '无',
}

const SKILL_TYPE_NAME: Record<SkillType, string> = {
  active: '主修残卷', divine: '神通残卷', passive: '被动残卷',
}

type ElementTag = Exclude<Element, null> | 'none'

function buildBook(skillType: SkillType, rarity: Rarity, elementTag: ElementTag): SkillBook {
  const element: Element = elementTag === 'none' ? null : elementTag
  const id = `book_${skillType}_${rarity}_${elementTag}`
  const name = `${RARITY_NAME[rarity]}·${ELEMENT_NAME[elementTag]}系${SKILL_TYPE_NAME[skillType]}`
  const description = `${RARITY_NAME[rarity]}品质${SKILL_TYPE_NAME[skillType]}，${elementTag === 'none' ? '无元素倾向' : `装备${ELEMENT_NAME[elementTag]}系核心石时获得 +20% bonus`}`
  return { id, name, skillType, rarity, element, description }
}

export const ALL_BOOKS: SkillBook[] = []
for (const skillType of SKILL_TYPES) {
  for (const rarity of RARITIES) {
    for (const elementTag of ELEMENTS) {
      ALL_BOOKS.push(buildBook(skillType, rarity, elementTag))
    }
  }
}

export const BOOK_MAP: Record<string, SkillBook> = {}
for (const b of ALL_BOOKS) {
  BOOK_MAP[b.id] = b
}

export function bookIdOf(skillType: SkillType, rarity: Rarity, element: Element): string {
  const tag = element ?? 'none'
  return `book_${skillType}_${rarity}_${tag}`
}
