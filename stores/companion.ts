// 道侣系统状态管理 - design/system-companion.md Phase 1 MVP
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface CompanionListItem {
  id: number
  name: string
  quality: number
  qualityName: string
  qualityColor: string
  spiritualRoot: string
  rootName: string
  personality: string
  avatarId: string
  customAvatarUrl: string | null
  intimacy: number
  nextThreshold: number
  stage: string
  isOfficial: boolean
  sealLevel: number
  encounteredAt: string
  marriedAt: string | null
}

export interface CompanionDetail extends CompanionListItem {
  backgroundStory: string | null
  preferredGifts: string[]
  dislikedGifts: string[]
  pregnantUntil: string | null
  pregnantCount: number
  unlockedStages: Array<{ threshold: number; name: string; description: string; unlocked: boolean }>
  traits: {
    baseStatPct: number
    cultBonusMaxPct: number
    childAptitudeCap: number
    twinChance: number
    tripletChance: number
  }
  todayGiftIntimacyGained: number
  dailyGiftRemaining: number
  bornCount: number
  maxPerCompanion: number
}

export interface ExpeditionLocation {
  id: string
  name: string
  realmRequired: number
  rootBias: string[]
  description: string
  redJadeRange: [number, number]
  eligible: boolean
}

export interface ExpeditionStatus {
  countToday: number
  remaining: number
  dailyMax: number
  hardCap: number
  cost: number
  spiritStone: number
  rosterCount: number
  rosterMax: number
  rosterFull: boolean
  weeklyExtraUsed: number
  weeklyExtraLimit: number
  isFestival: boolean
}

export interface PendingEncounter {
  scriptId: string
  quality: number
  spiritualRoot: string
  personality: string
  avatarId: string
  generatedName: string
  initialIntimacy: number
}

export interface ExpeditionOutcome {
  type: 'encounter' | 'gift_material' | 'red_jade' | 'herb' | 'fortune' | 'mishap'
  encounter?: {
    pending: PendingEncounter
    script: { id: string; title: string; scene: string; npcDescription: string; style: string }
  }
  giftMaterials?: Array<{ itemId: string; quantity: number; kind: string }>
  redJade?: number
  herbs?: Array<{ herbId: string; quality: number; quantity: number }>
  text?: string
  rewardOrPenalty?: {
    redJade?: number
    seeds?: Array<{ itemId: string; quantity: number }>
    spiritStone?: number
  }
  spiritStoneBonus: number
}

export const useCompanionStore = defineStore('companion', () => {
  // ===== 状态 =====
  const companions = ref<CompanionListItem[]>([])
  const officialCompanion = ref<CompanionListItem | null>(null)
  const detailCache = ref<Record<number, CompanionDetail>>({})
  // Phase 4: 和离冷却（characters.divorce_cooldown，ISO 字符串）
  const divorceCooldownUntil = ref<string | null>(null)

  const expeditionStatus = ref<ExpeditionStatus | null>(null)
  const expeditionLocations = ref<ExpeditionLocation[]>([])

  // 邂逅事件待处理
  const pendingEncounter = ref<PendingEncounter | null>(null)
  const pendingScript = ref<{ id: string; title: string; scene: string; npcDescription: string; style: string } | null>(null)

  // 最近一次游历产出（非邂逅类用于结果弹窗）
  const lastOutcome = ref<ExpeditionOutcome | null>(null)

  const loading = ref(false)
  const acting = ref(false)

  // ===== 操作 =====
  async function loadCompanions() {
    const api = useApi()
    loading.value = true
    try {
      const res = await api<{ code: number; data?: { companions: CompanionListItem[]; divorceCooldownUntil: string | null } }>('/companion/list')
      if (res.code === 200 && res.data) {
        companions.value = res.data.companions
        officialCompanion.value = companions.value.find(c => c.isOfficial) || null
        divorceCooldownUntil.value = res.data.divorceCooldownUntil || null
      }
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(companionId: number, force = false): Promise<CompanionDetail | null> {
    if (!force && detailCache.value[companionId]) return detailCache.value[companionId]
    const api = useApi()
    const res = await api<{ code: number; data?: CompanionDetail }>(`/companion/detail/${companionId}`)
    if (res.code === 200 && res.data) {
      detailCache.value[companionId] = res.data
      return res.data
    }
    return null
  }

  async function loadExpeditionStatus() {
    const api = useApi()
    const res = await api<{ code: number; data?: ExpeditionStatus }>('/expedition/status')
    if (res.code === 200 && res.data) {
      expeditionStatus.value = res.data
    }
  }

  async function loadExpeditionLocations() {
    const api = useApi()
    const res = await api<{ code: number; data?: { locations: ExpeditionLocation[] } }>('/expedition/locations')
    if (res.code === 200 && res.data) {
      expeditionLocations.value = res.data.locations
    }
  }

  async function startExpedition(locationId: string): Promise<{ ok: boolean; message?: string; outcome?: ExpeditionOutcome }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: { outcome: ExpeditionOutcome; remaining: number; rosterFull: boolean } }>(
        '/expedition/start',
        { method: 'POST', body: { location_id: locationId } }
      )
      if (res.code !== 200 || !res.data) {
        return { ok: false, message: res.message || '游历失败' }
      }
      lastOutcome.value = res.data.outcome

      // 邂逅类型：暂存 pending 数据待 4 选项处理
      if (res.data.outcome.type === 'encounter' && res.data.outcome.encounter) {
        pendingEncounter.value = res.data.outcome.encounter.pending
        pendingScript.value = res.data.outcome.encounter.script
      }

      // 刷新状态
      if (expeditionStatus.value) {
        expeditionStatus.value.countToday += 1
        expeditionStatus.value.remaining = res.data.remaining
      }

      return { ok: true, outcome: res.data.outcome }
    } catch (e: any) {
      return { ok: false, message: e?.message || '游历失败' }
    } finally {
      acting.value = false
    }
  }

  async function chooseEncounter(choice: 'A' | 'B' | 'C' | 'D', battleWon = false): Promise<{ ok: boolean; message?: string; accepted?: boolean; companion?: any }> {
    if (!pendingEncounter.value) return { ok: false, message: '无待处理邂逅' }
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: { accepted: boolean; companion?: any; message?: string } }>(
        '/companion/encounter-choose',
        { method: 'POST', body: { pending: pendingEncounter.value, choice, battle_won: battleWon } }
      )
      if (res.code !== 200) return { ok: false, message: res.message }

      pendingEncounter.value = null
      pendingScript.value = null

      // 录入花名册后刷新列表
      if (res.data?.accepted) await loadCompanions()

      return { ok: true, accepted: res.data?.accepted, companion: res.data?.companion, message: res.data?.message || res.message }
    } finally {
      acting.value = false
    }
  }

  async function abandonCompanion(companionId: number): Promise<{ ok: boolean; message?: string }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string }>('/companion/abandon', {
        method: 'POST',
        body: { companion_id: companionId },
      })
      if (res.code === 200) {
        await loadCompanions()
        delete detailCache.value[companionId]
        return { ok: true, message: res.message }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function marryCompanion(companionId: number): Promise<{ ok: boolean; message?: string }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string }>('/companion/marry', {
        method: 'POST',
        body: { companion_id: companionId },
      })
      if (res.code === 200) {
        await loadCompanions()
        delete detailCache.value[companionId]
        return { ok: true, message: res.message }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function settleCompanionship(): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/companion/settle-companionship', {
        method: 'POST',
      })
      if (res.code === 200) {
        if (res.data?.settled) await loadCompanions()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } catch (e: any) {
      return { ok: false, message: e?.message || '结算失败' }
    }
  }

  async function giftCompanion(companionId: number, giftId: string, quantity: number): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/companion/gift', {
        method: 'POST',
        body: { companion_id: companionId, gift_id: giftId, quantity },
      })
      if (res.code === 200) {
        await loadDetail(companionId, true)
        await loadCompanions()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  function clearPendingEncounter() {
    pendingEncounter.value = null
    pendingScript.value = null
  }

  function clearLastOutcome() {
    lastOutcome.value = null
  }

  // ===== Phase 3: 子女系统 =====
  const children = ref<any[]>([])
  const battlingChildId = ref<number | null>(null)
  const lastBirths = ref<any[] | null>(null)  // 出生时返回的新生儿数组（用于 BirthModal）

  async function loadChildren() {
    const api = useApi()
    const res = await api<{ code: number; data?: { children: any[]; battlingChildId: number | null } }>('/child/list')
    if (res.code === 200 && res.data) {
      children.value = res.data.children
      battlingChildId.value = res.data.battlingChildId
    }
  }

  async function loadChildDetail(childId: number): Promise<any | null> {
    const api = useApi()
    const res = await api<{ code: number; data?: any }>(`/child/detail/${childId}`)
    if (res.code === 200) return res.data
    return null
  }

  async function conceive(): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    const res = await api<{ code: number; message?: string; data?: any }>('/companion/conceive', { method: 'POST' })
    if (res.code === 200) {
      await loadCompanions()
      return { ok: true, message: res.message, data: res.data }
    }
    return { ok: false, message: res.message }
  }

  async function conceiveClaim(): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    const res = await api<{ code: number; message?: string; data?: any }>('/companion/conceive-claim', { method: 'POST' })
    if (res.code === 200) {
      lastBirths.value = res.data?.births || []
      await loadCompanions()
      await loadChildren()
      return { ok: true, message: res.message, data: res.data }
    }
    return { ok: false, message: res.message }
  }

  async function feedChild(childId: number, herbId: string, herbQuality: string): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    const res = await api<{ code: number; message?: string; data?: any }>('/child/feed', {
      method: 'POST',
      body: { child_id: childId, herb_id: herbId, herb_quality: herbQuality },
    })
    if (res.code === 200) {
      await loadChildren()
      return { ok: true, message: res.message, data: res.data }
    }
    return { ok: false, message: res.message }
  }

  async function setBattlingChild(childId: number | null): Promise<{ ok: boolean; message?: string }> {
    const api = useApi()
    const res = await api<{ code: number; message?: string }>('/child/set-battling', {
      method: 'POST',
      body: { child_id: childId },
    })
    if (res.code === 200) {
      await loadChildren()
      battlingChildId.value = childId
      return { ok: true, message: res.message }
    }
    return { ok: false, message: res.message }
  }

  function clearLastBirths() { lastBirths.value = null }

  // ===== Phase 4: 和离 / 成年 / 资质重铸 =====
  async function divorceCompanion(): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/companion/divorce', { method: 'POST' })
      if (res.code === 200) {
        await loadCompanions()
        await loadChildren()
        detailCache.value = {}
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function rerollChildAptitude(childId: number): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/reroll-aptitude', {
        method: 'POST',
        body: { child_id: childId },
      })
      if (res.code === 200) {
        await loadChildren()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function rerollChildSkill(childId: number, slot: number, acceptNew = true): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/reroll-skill', {
        method: 'POST',
        body: { child_id: childId, slot, accept_new: acceptNew },
      })
      if (res.code === 200) {
        await loadChildren()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function rerollChildTalent(childId: number, slotLevel: number, acceptNew = true): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/reroll-talent', {
        method: 'POST',
        body: { child_id: childId, slot_level: slotLevel, accept_new: acceptNew },
      })
      if (res.code === 200) {
        await loadChildren()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function comeOfAgeChild(childId: number, choice: 'stay' | 'leave'): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/come-of-age', {
        method: 'POST',
        body: { child_id: childId, choice },
      })
      if (res.code === 200) {
        await loadChildren()
        if (choice === 'leave') battlingChildId.value = null
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function recallChildHome(childId: number): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/recall-home', {
        method: 'POST',
        body: { child_id: childId },
      })
      if (res.code === 200) {
        await loadChildren()
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  async function abandonChild(childId: number): Promise<{ ok: boolean; message?: string; data?: any }> {
    const api = useApi()
    acting.value = true
    try {
      const res = await api<{ code: number; message?: string; data?: any }>('/child/abandon', {
        method: 'POST',
        body: { child_id: childId },
      })
      if (res.code === 200) {
        await loadChildren()
        if (battlingChildId.value === childId) battlingChildId.value = null
        return { ok: true, message: res.message, data: res.data }
      }
      return { ok: false, message: res.message }
    } finally {
      acting.value = false
    }
  }

  return {
    companions, officialCompanion, detailCache, divorceCooldownUntil,
    expeditionStatus, expeditionLocations,
    pendingEncounter, pendingScript, lastOutcome,
    loading, acting,
    loadCompanions, loadDetail,
    loadExpeditionStatus, loadExpeditionLocations,
    startExpedition, chooseEncounter,
    abandonCompanion, marryCompanion,
    settleCompanionship, giftCompanion,
    clearPendingEncounter, clearLastOutcome,
    // Phase 3
    children, battlingChildId, lastBirths,
    loadChildren, loadChildDetail,
    conceive, conceiveClaim,
    feedChild, setBattlingChild,
    clearLastBirths,
    // Phase 4
    divorceCompanion, rerollChildAptitude, rerollChildSkill, rerollChildTalent, comeOfAgeChild, recallChildHome,
    abandonChild,
  }
})
