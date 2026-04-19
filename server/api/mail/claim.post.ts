import { getCharByUserId } from '~/server/utils/sect'
import { claimMailAttachments } from '~/server/utils/mail'

export default defineEventHandler(async (event) => {
  const char = await getCharByUserId(event.context.userId)
  if (!char) return { code: 400, message: '角色不存在' }
  const body = await readBody(event)
  const mailId = Number(body?.id)
  if (!Number.isInteger(mailId) || mailId <= 0) {
    return { code: 400, message: '邮件 id 无效' }
  }
  const result = await claimMailAttachments(char.id, mailId)
  if (!result.ok) return { code: 400, message: result.message }
  return { code: 200, message: result.message, data: { granted: result.granted || [] } }
})
