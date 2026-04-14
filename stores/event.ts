// 天道造化事件 & 风云阁 store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface PendingEvent {
  logId: number
  eventId: string
  eventName: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  isPositive: boolean
  template: string
  reward: any
  triggeredAt: string
}

export interface BroadcastItem {
  id: number
  characterId: number
  characterName: string
  sectId: number | null
  eventId: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  isPositive: boolean
  text: string
  createdAt: string
}

export const useEventStore = defineStore('event', () => {
  const pendingEvent = ref<PendingEvent | null>(null)
  const broadcasts = ref<BroadcastItem[]>([])
  const panelOpen = ref(false)
  const unreadLegendaryCount = ref(0)
  const lastSeenBroadcastId = ref<number>(0)

  const pollTimer = ref<any>(null)

  function getAuthHeaders() {
    const userStore = useUserStore()
    return { Authorization: userStore.token ? `Bearer ${userStore.token}` : '' }
  }

  async function fetchApi<T = any>(url: string, options: any = {}): Promise<T> {
    return $fetch(url, {
      baseURL: '/api',
      headers: getAuthHeaders(),
      ...options,
    }) as unknown as Promise<T>
  }

  async function checkPending() {
    try {
      const res: any = await fetchApi('/event/pending')
      if (res.code === 200 && res.data && (!pendingEvent.value || pendingEvent.value.logId !== res.data.logId)) {
        pendingEvent.value = res.data
      } else if (res.code === 200 && !res.data) {
        pendingEvent.value = null
      }
    } catch (e) {
      // 静默失败
    }
  }

  async function claim() {
    if (!pendingEvent.value) return null
    try {
      const res: any = await fetchApi('/event/claim', { method: 'POST' })
      pendingEvent.value = null
      if (res.code === 200 && res.data) {
        // 同步最新角色数据到 game store
        const gs = useGameStore()
        gs.character = res.data
      }
      return res
    } catch (e) {
      return null
    }
  }

  async function loadBroadcasts(opts: { rarity?: string; scope?: 'all' | 'sect'; limit?: number } = {}) {
    try {
      const query: any = { limit: opts.limit || 50 }
      if (opts.rarity) query.rarity = opts.rarity
      if (opts.scope) query.scope = opts.scope
      const res: any = await fetchApi('/event/broadcast', { query })
      if (res.code === 200 && Array.isArray(res.data)) {
        broadcasts.value = res.data
        // 统计传说级未读数
        const legendaryNew = res.data.filter(
          (r: BroadcastItem) => r.rarity === 'legendary' && r.id > lastSeenBroadcastId.value
        ).length
        unreadLegendaryCount.value = legendaryNew
      }
    } catch (e) {
      // 静默
    }
  }

  function markAllRead() {
    if (broadcasts.value.length > 0) {
      lastSeenBroadcastId.value = Math.max(...broadcasts.value.map(b => b.id))
    }
    unreadLegendaryCount.value = 0
  }

  function openPanel() {
    panelOpen.value = true
    loadBroadcasts()
  }

  function closePanel() {
    panelOpen.value = false
    markAllRead()
  }

  function startPolling() {
    if (pollTimer.value) return
    checkPending()
    loadBroadcasts()
    pollTimer.value = setInterval(() => {
      checkPending()
      // 风云阁在面板关闭时也悄悄刷新，用于红点
      loadBroadcasts()
    }, 60_000)
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
  }

  return {
    pendingEvent,
    broadcasts,
    panelOpen,
    unreadLegendaryCount,
    checkPending,
    claim,
    loadBroadcasts,
    openPanel,
    closePanel,
    markAllRead,
    startPolling,
    stopPolling,
  }
})
