// 怀胎到期领取 - POST /api/companion/conceive-claim
// 调用时机：玩家手动点"出生"按钮，或 48 小时到期自动跳出

import { getPool } from '~/server/database/db'
import { getCharacterByUserId } from '~/server/utils/team'
import { getOfficialCompanion } from '~/server/utils/companion'
import { birthChild, type BirthInputs } from '~/server/utils/child'
import type { CompanionQuality, SpiritualRoot } from '~/server/engine/companionData'

export default defineEventHandler(async (event) => {
  try {
    const pool = getPool()
    const char = await getCharacterByUserId(event.context.userId)
    if (!char) return { code: 400, message: '角色不存在' }

    const c = await getOfficialCompanion(pool, char.id)
    if (!c) return { code: 400, message: '需先正式结侣' }
    if (!c.pregnant_until) return { code: 400, message: '当前未怀胎' }
    if (new Date(c.pregnant_until).getTime() > Date.now()) {
      const remaining = Math.ceil((new Date(c.pregnant_until).getTime() - Date.now()) / 1000 / 3600)
      return { code: 400, message: `怀胎中，剩余 ${remaining} 小时` }
    }

    const pregnantCount = c.pregnant_count || 1
    const inputs: BirthInputs = {
      characterId: char.id,
      parentCompanionId: c.id,
      parentSurname: char.name?.[0] || '清',
      playerAptitude: char.aptitude || 1,
      playerElement: char.spiritual_root as SpiritualRoot,
      companionQuality: c.quality as CompanionQuality,
      companionElement: c.spiritual_root as SpiritualRoot,
    }

    const births: any[] = []
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < pregnantCount; i++) {
        const result = await birthChild(client, inputs)
        births.push({
          child: result.child,
          firstTalent: result.talent,
          innateSkill: result.skill,
        })
      }
      // 清除怀胎状态
      await client.query(
        'UPDATE companions SET pregnant_until = NULL, pregnant_count = 0 WHERE id = $1',
        [c.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return {
      code: 200,
      data: { births },
      message: pregnantCount === 3 ? '🎉 喜得三胎！' : pregnantCount === 2 ? '🎉 喜得双胎！' : '🎉 弄璋之喜！',
    }
  } catch (error) {
    console.error('出生失败:', error)
    return { code: 500, message: '服务器错误' }
  }
})
