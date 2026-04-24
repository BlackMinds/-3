// 返回完整石头和书的静态数据（供前端 UI 渲染）
import { ALL_STONES, STONE_MAP } from '~/server/engine/stoneData'
import { ALL_BOOKS } from '~/server/engine/skillBookData'

export default defineEventHandler(() => {
  return {
    code: 200,
    data: {
      stones: ALL_STONES,
      books: ALL_BOOKS,
    },
  }
})
