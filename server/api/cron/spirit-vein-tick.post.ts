import { processSurge, purgeExpiredGuards, restoreNpcNodes } from '~/server/utils/spiritVeinEngine'

/**
 * 灵脉每小时 tick - 涌灵（若时间到）+ 守卫过期清理 + 真空期恢复
 * 通过 GitHub Actions 每小时触发
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const surgeRes = await processSurge()
  const purgeRes = await purgeExpiredGuards()
  const restoreRes = await restoreNpcNodes()
  return { ok: true, surge: surgeRes, purge: purgeRes, restore: restoreRes }
})
