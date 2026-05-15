import { sendMail, type MailAttachment } from '~/server/utils/mail'
import { writeAudit, getClientIp, loadTargetCharacter } from '~/server/utils/adminAudit'

// 给玩家发系统邮件，可带附件
// body: {
//   title: string,
//   content: string,
//   attachments?: [
//     { type: 'spirit_stone', amount } |
//     { type: 'pill', pillId, qualityFactor?, qty } |
//     ... 其他类型见 server/utils/mail.ts MailAttachment
//   ],
//   ttlDays?: number (默认 30)
// }
export default defineEventHandler(async (event) => {
  const characterId = Number(event.context.params?.id)
  const { title, content, attachments, ttlDays } = await readBody<{
    title: string; content: string; attachments?: MailAttachment[]; ttlDays?: number
  }>(event)

  if (!title || !content) return { code: 400, message: 'title / content 必填' }
  if (title.length > 30) return { code: 400, message: 'title 最长 30 字' }
  if (content.length > 2000) return { code: 400, message: 'content 最长 2000 字' }

  const target = await loadTargetCharacter(characterId)
  if (!target) return { code: 404, message: '玩家不存在' }

  const mailId = await sendMail({
    characterId,
    category: 'system',
    title,
    content,
    attachments: Array.isArray(attachments) ? attachments : [],
    ttlDays: ttlDays && ttlDays > 0 && ttlDays <= 90 ? ttlDays : 30,
  })

  await writeAudit({
    adminId: event.context.adminId,
    action: 'send_mail',
    targetCharacterId: characterId,
    payload: {
      mailId, title, contentLen: content.length,
      attachmentCount: attachments?.length || 0,
      attachments: attachments || [],
      characterName: target.name,
    },
    ip: getClientIp(event),
  })

  return { code: 200, message: `已发送邮件「${title}」`, data: { mailId } }
})
