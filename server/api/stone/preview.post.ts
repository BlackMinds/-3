// 预览一组石头镶嵌后的最终效果（不落库，纯计算）
// body: { bookId: string, stones: (string|null)[], characterRoot?: string }
import { resolve, validateSlotted } from '~/server/engine/stoneResolver'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    bookId: string
    stones: (string | null)[]
    characterRoot?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | null
  }>(event)

  if (!body?.bookId || !Array.isArray(body.stones)) {
    return { code: 400, message: '参数错误' }
  }

  const v = validateSlotted(body.bookId, body.stones)
  if (!v.ok) return { code: 400, message: v.error }

  const r = resolve(body.bookId, body.stones, {
    applyRootMatch: !!body.characterRoot,
    characterRoot: body.characterRoot ?? null,
  })
  if (!r.ok) return { code: 400, message: r.error }

  return { code: 200, data: r.skill }
})
