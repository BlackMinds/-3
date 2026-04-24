import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TeamRoomLeader {
  id: number
  name: string
  realm_tier: number
  realm_stage: number
  level: number
  sect_id: number | null
  sect_name: string | null
}

export interface TeamRoomMember {
  character_id: number
  name: string
  realm_tier: number
  realm_stage: number
  level: number
  spiritual_root: string
  sect_id: number | null
  sect_name: string | null
  is_leader: boolean
  is_ready: boolean
}

export interface TeamRoomListItem {
  room_id: number
  secret_realm_id: string
  secret_realm_name: string
  difficulty: 1 | 2 | 3
  difficulty_name: string
  current_members: number
  max_members: number
  created_at: string
  leader: TeamRoomLeader
  is_same_sect: boolean
  is_eligible: boolean
}

export interface TeamRoomDetail {
  room_id: number
  secret_realm_id: string
  secret_realm_name: string
  difficulty: 1 | 2 | 3
  difficulty_name: string
  status: string
  max_members: number
  current_members: number
  created_at: string
  members: TeamRoomMember[]
}

export interface SecretRealmInfo {
  id: string
  name: string
  req_realm_tier: number
  req_level: number
  element: string | null
  description: string
  drop_tier: number
  is_unlocked: boolean
  difficulties: {
    level: number
    name: string
    waves: number
    reward_mul: number
    base_points: number
    best_rating: string | null
    clear_count: number
  }[]
}

export const useTeamStore = defineStore('team', () => {
  const lobbyRooms = ref<TeamRoomListItem[]>([])
  const currentRoom = ref<TeamRoomDetail | null>(null)
  const realms = ref<SecretRealmInfo[]>([])
  const playerInfo = ref({
    realm_tier: 1,
    realm_stage: 1,
    level: 1,
    realm_points: 0,
    sr_daily_count: 0,
    sr_daily_max: 2,
  })
  const battleResult = ref<any | null>(null)
  const battleHistory = ref<any[]>([])
  const historyDetail = ref<any | null>(null)
  const currentPanel = ref<
    'lobby' | 'realms' | 'create' | 'room' | 'battle' | 'result' | 'history' | 'history-detail' | 'shop'
  >('lobby')

  function setRoom(room: TeamRoomDetail | null) {
    currentRoom.value = room
    if (room) currentPanel.value = 'room'
  }

  function reset() {
    currentRoom.value = null
    battleResult.value = null
    currentPanel.value = 'lobby'
  }

  return {
    lobbyRooms,
    currentRoom,
    realms,
    playerInfo,
    battleResult,
    battleHistory,
    historyDetail,
    currentPanel,
    setRoom,
    reset,
  }
})
