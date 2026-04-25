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

  // P5: 合并 pending + broadcasts 一次拉取（用于定时轮询，省一半 Function 调用）
  // 仅供 startPolling/初始化使用；面板打开后切换 rarity/scope 仍走 loadBroadcasts
  async function pollBoth() {
    try {
      const res: any = await fetchApi('/event/poll')
      if (res.code !== 200 || !res.data) return
      const p = res.data.pending
      if (p) {
        if (!pendingEvent.value || pendingEvent.value.logId !== p.logId) {
          pendingEvent.value = p
        }
      } else {
        pendingEvent.value = null
      }
      if (Array.isArray(res.data.broadcasts)) {
        broadcasts.value = res.data.broadcasts
        const legendaryNew = res.data.broadcasts.filter(
          (r: BroadcastItem) => r.rarity === 'legendary' && r.id > lastSeenBroadcastId.value
        ).length
        unreadLegendaryCount.value = legendaryNew
      }
    } catch (e) {
      // 静默失败
    }
  }

  function startPolling() {
    if (pollTimer.value) return
    pollBoth()
    // P4: 60s → 120s,后台标签页跳过,降低 Function 调用
    // P5: 合并 pending + broadcasts 为单次调用（每轮 2 → 1 个 Function 调用）
    pollTimer.value = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      pollBoth()
    }, 120_000)
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
