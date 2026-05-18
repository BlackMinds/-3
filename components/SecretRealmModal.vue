<template>
  <div v-if="open" class="sr-modal-overlay" @click.self="handleClose">
    <div class="sr-modal">
      <!-- 顶部栏 -->
      <div class="sr-header">
        <div class="sr-title">万界秘境</div>
        <div class="sr-header-info" v-if="teamStore.playerInfo">
          <span>今日次数 <b>{{ teamStore.playerInfo.sr_daily_count }}/{{ teamStore.playerInfo.sr_daily_max }}</b></span>
          <span v-if="teamStore.playerInfo.sr_daily_fail_protect > 0" class="sr-fail-protect">
            失败保护 <b>{{ Math.max(0, teamStore.playerInfo.sr_daily_fail_protect - teamStore.playerInfo.sr_daily_fail) }}/{{ teamStore.playerInfo.sr_daily_fail_protect }}</b>
          </span>
          <span>秘境积分 <b>{{ teamStore.playerInfo.realm_points }}</b></span>
        </div>
        <button class="sr-close" @click="handleClose">×</button>
      </div>

      <!-- 当前在房间中的横幅 -->
      <div v-if="teamStore.currentRoom && teamStore.currentPanel !== 'room' && teamStore.currentPanel !== 'battle' && teamStore.currentPanel !== 'result'"
           class="sr-banner" @click="teamStore.currentPanel = 'room'">
        你当前在房间【{{ teamStore.currentRoom.secret_realm_name }} · {{ teamStore.currentRoom.difficulty_name }}】 &nbsp; [点击返回房间]
      </div>

      <!-- Tab 切换 -->
      <div class="sr-tabs" v-if="['lobby','realms','history','shop'].includes(teamStore.currentPanel)">
        <button :class="{ active: teamStore.currentPanel === 'lobby' }" @click="goLobby">组队大厅</button>
        <button :class="{ active: teamStore.currentPanel === 'realms' }" @click="goRealms">秘境介绍</button>
        <button :class="{ active: teamStore.currentPanel === 'shop' }" @click="goShop">🏪 积分商店</button>
        <button :class="{ active: teamStore.currentPanel === 'history' }" @click="goHistory">📜 历史日志</button>
        <button class="create-btn" @click="goCreate">+ 创建房间</button>
      </div>

      <!-- Panel: 大厅 -->
      <div v-if="teamStore.currentPanel === 'lobby'" class="sr-panel">
        <div class="sr-toolbar">
          <select v-model="filterRealm" @change="fetchRooms">
            <option value="">全部秘境</option>
            <option v-for="r in teamStore.realms" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
          <select v-model="filterDifficulty" @change="fetchRooms">
            <option value="">全部难度</option>
            <option value="1">普通</option>
            <option value="2">困难</option>
            <option value="3">噩梦</option>
          </select>
          <label><input type="checkbox" v-model="onlyAvailable" @change="fetchRooms" /> 仅显示可加入</label>
          <button class="refresh-btn" @click="fetchRooms">↻ 刷新</button>
        </div>

        <div class="sr-room-list">
          <div v-if="teamStore.lobbyRooms.length === 0" class="sr-empty">
            大厅空荡荡的…点击右上角【+ 创建房间】开启一场秘境吧！
          </div>
          <div v-for="room in teamStore.lobbyRooms" :key="room.room_id"
               :class="['sr-room-card', { highlight: room.is_same_sect, disabled: !room.is_eligible }]">
            <div class="room-info">
              <div class="room-title">
                <span v-if="room.is_same_sect" class="sect-badge">同宗门</span>
                {{ room.secret_realm_name }} · {{ room.difficulty_name }}
              </div>
              <div class="room-meta">
                队长：<b>{{ room.leader.name }}</b>
                <span class="leader-realm">{{ realmShort(room.leader.realm_tier, room.leader.realm_stage) }}</span>
                <span v-if="room.leader.sect_name" class="leader-sect">{{ room.leader.sect_name }}</span>
              </div>
            </div>
            <div class="room-actions">
              <div class="room-count">{{ room.current_members }}/{{ room.max_members }}</div>
              <button class="join-btn"
                      :disabled="!room.is_eligible || room.current_members >= room.max_members || loading"
                      @click="joinRoom(room.room_id)">
                {{ !room.is_eligible ? '境界不足' : (room.current_members >= room.max_members ? '已满' : '加入') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel: 积分商店 -->
      <SecretRealmShop v-if="teamStore.currentPanel === 'shop'" @updated="onShopUpdated" />

      <!-- Panel: 秘境介绍 -->
      <div v-if="teamStore.currentPanel === 'realms'" class="sr-panel">
        <div class="sr-realms-grid">
          <div v-for="r in teamStore.realms" :key="r.id"
               :class="['realm-card', { locked: !r.is_unlocked }]">
            <div class="realm-title">
              {{ r.name }}
              <span class="realm-id">{{ r.id }}</span>
              <span v-if="r.element" class="realm-elem" :style="{ color: elemColor(r.element) }">{{ elemName(r.element) }}</span>
              <span v-if="!r.is_unlocked" class="realm-lock">🔒 {{ realmTierName(r.req_realm_tier) }} Lv.{{ r.req_level }}</span>
            </div>
            <div class="realm-desc">{{ r.description }}</div>
            <div class="realm-difficulties">
              <div v-for="d in r.difficulties" :key="d.level" class="difficulty-row">
                <span class="diff-name">{{ d.name }}</span>
                <span class="diff-info">{{ d.waves }} 波 · {{ d.reward_mul }}x 奖励</span>
                <span v-if="d.clear_count > 0" class="diff-clears">通关 {{ d.clear_count }} 次</span>
                <span v-if="d.best_rating" :class="['diff-rating', 'r-' + d.best_rating]">{{ d.best_rating }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel: 创建房间 -->
      <div v-if="teamStore.currentPanel === 'create'" class="sr-panel">
        <h3 class="sr-section-title">创建秘境房间</h3>
        <div class="create-form">
          <div class="form-label">选择秘境：</div>
          <div class="realm-choose">
            <button v-for="r in teamStore.realms" :key="r.id"
                    :class="['realm-choice', { active: selectedRealm === r.id, locked: !r.is_unlocked }]"
                    :disabled="!r.is_unlocked"
                    @click="selectedRealm = r.id">
              {{ r.name }} <span class="tier-hint">T{{ r.drop_tier }}</span>
              <span v-if="!r.is_unlocked" class="lock-hint">🔒</span>
            </button>
          </div>
          <div class="form-label">选择难度：</div>
          <div class="realm-choose">
            <button v-for="d in ([1,2,3] as (1|2|3)[])" :key="d"
                    :class="['diff-choice', { active: selectedDifficulty === d }]"
                    @click="selectedDifficulty = d">
              {{ ['普通','困难','噩梦'][d-1] }}
            </button>
          </div>
          <div class="form-actions">
            <button class="btn-cancel" @click="goLobby">取消</button>
            <button class="btn-primary"
                    :disabled="!selectedRealm || loading"
                    @click="createRoom">
              {{ loading ? '创建中...' : '创建房间' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Panel: 房间等待 -->
      <div v-if="teamStore.currentPanel === 'room' && teamStore.currentRoom" class="sr-panel">
        <div class="room-header">
          <div class="room-header-title">
            【{{ teamStore.currentRoom.secret_realm_name }}】· {{ teamStore.currentRoom.difficulty_name }}
          </div>
          <div class="room-header-sub">房间号 #{{ teamStore.currentRoom.room_id }} · {{ teamStore.currentRoom.current_members }}/{{ teamStore.currentRoom.max_members }} 人</div>
        </div>
        <div class="member-grid">
          <div v-for="slot in teamStore.currentRoom.max_members" :key="slot" class="member-slot">
            <div v-if="teamStore.currentRoom.members[slot-1]" :class="['member-card', getMemberVariant(slot)?.cardClass]">
              <div class="member-main">
                <span v-if="teamStore.currentRoom.members[slot-1].is_leader" class="leader-icon">👑</span>
                <span v-if="getMemberVariant(slot)?.decoration" :class="getMemberVariant(slot)?.decorationClass">{{ getMemberVariant(slot)?.decoration }}</span>
                <span class="member-name">{{ teamStore.currentRoom.members[slot-1].name }}</span>
                <span v-if="getMemberVariant(slot)?.badgeText" :class="getMemberVariant(slot)?.badgeClass">{{ getMemberVariant(slot)?.badgeText }}</span>
                <span class="member-elem" :style="{ color: elemColor(teamStore.currentRoom.members[slot-1].spiritual_root) }">
                  {{ elemName(teamStore.currentRoom.members[slot-1].spiritual_root) }}灵根
                </span>
              </div>
              <div class="member-sub">
                {{ realmShort(teamStore.currentRoom.members[slot-1].realm_tier, teamStore.currentRoom.members[slot-1].realm_stage) }}
                · Lv.{{ teamStore.currentRoom.members[slot-1].level }}
                <span v-if="teamStore.currentRoom.members[slot-1].sect_name" class="member-sect">{{ teamStore.currentRoom.members[slot-1].sect_name }}</span>
              </div>
              <div class="member-status">
                <span v-if="teamStore.currentRoom.members[slot-1].is_leader" class="ready leader">队长</span>
                <span v-else-if="teamStore.currentRoom.members[slot-1].is_ready" class="ready ok">✓ 已准备</span>
                <span v-else class="ready wait">等待准备</span>
                <button v-if="isLeader && !teamStore.currentRoom.members[slot-1].is_leader"
                        class="kick-btn"
                        @click="kickMember(teamStore.currentRoom.members[slot-1].character_id)">踢出</button>
              </div>
            </div>
            <div v-else class="member-empty">
              <span>等待加入...</span>
            </div>
          </div>
        </div>

        <div class="room-actions-bar">
          <button v-if="!isLeader" class="btn-ready"
                  :class="{ active: meReady }"
                  @click="toggleReady">
            {{ meReady ? '取消准备' : '准备' }}
          </button>
          <button v-if="isLeader" class="btn-primary btn-start"
                  :disabled="!allReady || loading"
                  @click="startBattle">
            {{ loading ? '战斗中...' : (allReady ? '开始战斗' : '等待队员准备') }}
          </button>
          <button class="btn-cancel" @click="leaveRoom">离开房间</button>
        </div>
      </div>

      <!-- Panel: 战斗播放 -->
      <div v-if="teamStore.currentPanel === 'battle'" class="sr-panel battle-panel">
        <div class="battle-header">
          <div>战斗中... 正在播放日志</div>
          <div class="battle-progress">{{ battleLogIndex }}/{{ totalLogs }}</div>
        </div>
        <div class="battle-log-box" ref="battleLogBoxRef">
          <div v-for="(log, i) in displayedLogs" :key="i" :class="['battle-log-line', 'log-' + (log.type || 'normal')]">
            <span class="log-text">{{ log.text }}</span>
            <span v-if="fmtLogHp(log)" class="log-hp">{{ fmtLogHp(log) }}</span>
          </div>
        </div>
        <button class="btn-cancel" @click="skipToResult">跳过</button>
      </div>

      <!-- Panel: 结算页 -->
      <div v-if="teamStore.currentPanel === 'result' && teamStore.battleResult" class="sr-panel result-panel">
        <div :class="['result-rating', 'r-' + (teamStore.battleResult.rating || 'FAIL')]">
          <template v-if="teamStore.battleResult.result === 'victory'">
            <div class="rating-big">{{ teamStore.battleResult.rating }}</div>
            <div class="rating-sub">秘境通关！</div>
          </template>
          <template v-else>
            <div class="rating-big">!</div>
            <div class="rating-sub">秘境失败（通过 {{ teamStore.battleResult.waves_cleared }}/{{ teamStore.battleResult.total_waves }} 波）</div>
            <div v-if="anyFailProtected" class="rating-tip">本次失败受【试错保护】，不扣本日次数</div>
          </template>
        </div>

        <div class="result-section" v-if="!teamStore.battleResult.is_replay">
          <h3>队伍增益</h3>
          <div v-if="teamStore.battleResult.team_buffs && teamStore.battleResult.team_buffs.length > 0">
            <div v-for="(b, i) in teamStore.battleResult.team_buffs" :key="i" class="team-buff">{{ b }}</div>
          </div>
          <div v-else class="team-buff none">无（尝试组同灵根/同宗门的队友激活增益）</div>
        </div>

        <div class="result-section">
          <h3>贡献与奖励</h3>
          <div class="contribution-list">
            <div v-for="(r, i) in teamStore.battleResult.rewards" :key="i" class="contribution-row">
              <div class="c-name">{{ i + 1 }}. {{ r.name }}</div>
              <div class="c-stats">
                伤害 {{ formatNum(r.damage_dealt) }} · 治疗 {{ formatNum(r.healing_done) }} · 承伤 {{ formatNum(r.damage_taken) }}
              </div>
              <div class="c-reward">
                贡献 <b>{{ (r.contribution * 100).toFixed(1) }}%</b>
                · 灵石 <b>+{{ formatNum(r.spirit_stone) }}</b>
                · 修为 <b>+{{ formatNum(r.exp_gained) }}</b>
                · 积分 <b>+{{ r.realm_points }}</b>
                <span v-if="r.level_up" class="level-up">· 升至 Lv.{{ r.level_up }}</span>
              </div>
              <div v-if="hasDrops(r)" class="c-drops">
                <span v-for="(eq, ei) in r.equipments" :key="'e'+ei" class="drop-tag" :style="{ color: getRarityColor(eq.rarity), borderColor: getRarityColor(eq.rarity) }">
                  {{ eq.name }}
                </span>
                <span v-for="(h, hi) in r.herbs" :key="'h'+hi" class="drop-tag" :style="{ color: herbQualityColor(h.quality), borderColor: herbQualityColor(h.quality) }">
                  {{ herbName(h.herb_id) }} ×{{ h.count }}
                </span>
                <span v-for="(sp, si) in r.skill_pages" :key="'s'+si" class="drop-tag drop-skill">
                  {{ skillName(sp) }}
                </span>
                <span v-if="r.awaken_items && r.awaken_items.awaken_stone > 0" class="drop-tag drop-awaken">
                  附灵石 ×{{ r.awaken_items.awaken_stone }}
                </span>
                <span v-if="r.awaken_items && r.awaken_items.awaken_reroll > 0" class="drop-tag drop-awaken">
                  灵枢玉 ×{{ r.awaken_items.awaken_reroll }}
                </span>
                <span v-if="r.enhance_stones && r.enhance_stones.count > 0" class="drop-tag drop-stone">
                  强化石·T{{ r.enhance_stones.tier }} ×{{ r.enhance_stones.count }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="result-section" v-if="teamStore.battleResult.logs && teamStore.battleResult.logs.length > 0">
          <h3>
            <button class="log-toggle" @click="showResultLogs = !showResultLogs">
              📜 战斗日志 ({{ teamStore.battleResult.logs.length }} 条) {{ showResultLogs ? '▼' : '▶' }}
            </button>
          </h3>
          <div v-if="showResultLogs" class="log-review">
            <div v-for="(log, i) in teamStore.battleResult.logs" :key="i"
                 :class="['battle-log-line', 'log-' + (log.type || 'normal')]">
              <span class="log-text">{{ log.text }}</span>
              <span v-if="fmtLogHp(log)" class="log-hp">{{ fmtLogHp(log) }}</span>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn-primary" @click="backToLobby">返回组队大厅</button>
        </div>
      </div>

      <!-- Panel: 战斗历史列表 -->
      <div v-if="teamStore.currentPanel === 'history'" class="sr-panel">
        <div v-if="historyLoading" class="sr-empty">加载中...</div>
        <div v-else-if="teamStore.battleHistory.length === 0" class="sr-empty">
          暂无战斗记录。去打一场秘境吧！
        </div>
        <div v-else class="history-list">
          <div v-for="h in teamStore.battleHistory" :key="h.battle_id"
               :class="['history-row', { defeat: h.result === 'defeat' }]"
               @click="openHistoryDetail(h.battle_id)">
            <div :class="['hr-rating', 'r-' + (h.rating || 'FAIL')]">
              {{ h.result === 'victory' ? (h.rating || '—') : '!' }}
            </div>
            <div class="hr-main">
              <div class="hr-title">
                【{{ h.secret_realm_name }}】· {{ h.difficulty_name }}
                <span v-if="h.no_quota" class="hr-badge">带人</span>
              </div>
              <div class="hr-meta">
                {{ h.result === 'victory' ? '通关' : `失败 ${h.waves_cleared}/${h.total_waves}` }}
                · 贡献 {{ (h.my_contribution * 100).toFixed(1) }}%
                · 伤害 {{ formatNum(h.my_damage) }}
                <span v-if="!h.no_quota">· 灵石 +{{ formatNum(h.my_spirit_stone) }}</span>
              </div>
              <div class="hr-time">{{ formatTime(h.finished_at) }}</div>
            </div>
            <div class="hr-arrow">›</div>
          </div>
        </div>
      </div>

      <!-- Panel: 历史详情 -->
      <div v-if="teamStore.currentPanel === 'history-detail' && teamStore.historyDetail" class="sr-panel result-panel">
        <div class="history-back">
          <button class="btn-cancel" @click="backToHistory">← 返回列表</button>
          <span class="history-title">
            【{{ teamStore.historyDetail.secret_realm_name }}】· {{ teamStore.historyDetail.difficulty_name }}
            · {{ formatTime(teamStore.historyDetail.finished_at) }}
          </span>
        </div>
        <div :class="['result-rating', 'r-' + (teamStore.historyDetail.rating || 'FAIL')]">
          <template v-if="teamStore.historyDetail.result === 'victory'">
            <div class="rating-big">{{ teamStore.historyDetail.rating }}</div>
            <div class="rating-sub">秘境通关</div>
          </template>
          <template v-else>
            <div class="rating-big">!</div>
            <div class="rating-sub">秘境失败（通过 {{ teamStore.historyDetail.waves_cleared }}/{{ teamStore.historyDetail.total_waves }} 波）</div>
          </template>
        </div>

        <div class="result-section">
          <h3>贡献与奖励</h3>
          <div class="contribution-list">
            <div v-for="(r, i) in teamStore.historyDetail.rewards" :key="i" class="contribution-row">
              <div class="c-name">
                {{ i + 1 }}. {{ r.name }}
                <span v-if="r.no_quota" class="hr-badge">带人</span>
              </div>
              <div class="c-stats">
                伤害 {{ formatNum(r.damage_dealt) }} · 治疗 {{ formatNum(r.healing_done) }} · 承伤 {{ formatNum(r.damage_taken) }}
              </div>
              <div class="c-reward">
                贡献 <b>{{ (r.contribution * 100).toFixed(1) }}%</b>
                <template v-if="!r.no_quota">
                  · 灵石 <b>+{{ formatNum(r.spirit_stone) }}</b>
                  · 修为 <b>+{{ formatNum(r.exp_gained) }}</b>
                  · 积分 <b>+{{ r.realm_points }}</b>
                </template>
              </div>
              <div v-if="hasDrops(r)" class="c-drops">
                <span v-for="(eq, ei) in r.equipments" :key="'e'+ei" class="drop-tag"
                      :style="{ color: getRarityColor(eq.rarity), borderColor: getRarityColor(eq.rarity) }">
                  {{ eq.name }}
                </span>
                <span v-for="(hb, hi) in r.herbs" :key="'h'+hi" class="drop-tag"
                      :style="{ color: herbQualityColor(hb.quality), borderColor: herbQualityColor(hb.quality) }">
                  {{ herbName(hb.herb_id) }} ×{{ hb.count }}
                </span>
                <span v-for="(sp, si) in r.skill_pages" :key="'s'+si" class="drop-tag drop-skill">
                  {{ skillName(sp) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="result-section" v-if="teamStore.historyDetail.logs && teamStore.historyDetail.logs.length > 0">
          <h3>
            <button class="log-toggle" @click="showDetailLogs = !showDetailLogs">
              📜 战斗日志 ({{ teamStore.historyDetail.logs.length }} 条) {{ showDetailLogs ? '▼' : '▶' }}
            </button>
          </h3>
          <div v-if="showDetailLogs" class="log-review">
            <div v-for="(log, i) in teamStore.historyDetail.logs" :key="i"
                 :class="['battle-log-line', 'log-' + (log.type || 'normal')]">
              <span class="log-text">{{ log.text }}</span>
              <span v-if="fmtLogHp(log)" class="log-hp">{{ fmtLogHp(log) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useTeamStore } from '~/stores/team'
import { HERBS, HERB_QUALITIES } from '~/game/herbData'
import { ALL_SKILLS } from '~/game/skillData'
import { getRarityColor } from '~/game/equipData'
import SecretRealmShop from '~/components/SecretRealmShop.vue'
import { getSpecialVariant } from '~/shared/specialCard'

const props = defineProps<{
  open: boolean
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const teamStore = useTeamStore()

function getMemberVariant(slot: number) {
  const m = teamStore.currentRoom?.members?.[slot - 1]
  return m ? getSpecialVariant(m.name) : undefined
}
const loading = ref(false)

// 筛选
const filterRealm = ref('')
const filterDifficulty = ref('')
const onlyAvailable = ref(true)

// 创建表单
const selectedRealm = ref('')
const selectedDifficulty = ref<1 | 2 | 3>(1)

// 战斗日志播放
const displayedLogs = ref<any[]>([])
const battleLogIndex = ref(0)
const totalLogs = ref(0)
const logPlayTimer = ref<any>(null)
const pendingBattleData = ref<any>(null)
const battleLogBoxRef = ref<HTMLElement | null>(null)

// 历史日志
const historyLoading = ref(false)
const showResultLogs = ref(false)
const showDetailLogs = ref(false)

function fmtLogHp(log: any): string {
  const parts: string[] = []
  if (log.playerMaxHp > 0) parts.push(`我方 ${log.playerHp ?? 0}/${log.playerMaxHp}`)
  if (log.monsterMaxHp > 0) parts.push(`敌方 ${log.monsterHp ?? 0}/${log.monsterMaxHp}`)
  return parts.join(' · ')
}

// 轮询
let lobbyPollTimer: any = null
let roomPollTimer: any = null

// 使用项目已有的 composable
const api = useApi()

// ============ 工具函数 ============
function elemColor(e?: string | null): string {
  const map: Record<string, string> = {
    metal: '#d4d4d4', wood: '#6fcf97', water: '#56ccf2', fire: '#eb5757', earth: '#f2c94c',
  }
  return e ? (map[e] || '#888') : '#888'
}
function elemName(e?: string | null): string {
  const map: Record<string, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
  return e ? (map[e] || '—') : '—'
}
function realmTierName(t: number): string {
  return ['', '练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'][t] || '—'
}
function herbName(id: string): string {
  return HERBS.find(h => h.id === id)?.name || id
}
function herbQualityColor(q: string): string {
  return HERB_QUALITIES.find(x => x.id === q)?.color || '#CCCCCC'
}
function skillName(id: string): string {
  return ALL_SKILLS.find(s => s.id === id)?.name || id
}
function hasDrops(r: any): boolean {
  return (r.equipments?.length || 0) > 0
    || (r.herbs?.length || 0) > 0
    || (r.skill_pages?.length || 0) > 0
    || (r.awaken_items && (r.awaken_items.awaken_stone > 0 || r.awaken_items.awaken_reroll > 0))
    || (r.enhance_stones && r.enhance_stones.count > 0)
}
const anyFailProtected = computed(() => {
  const rewards = teamStore.battleResult?.rewards
  if (!Array.isArray(rewards)) return false
  return rewards.some((r: any) => r && r.fail_protected)
})
const STAGE_NAMES = ['初期', '中期', '后期']
function realmShort(tier: number, stage: number): string {
  const tierName = realmTierName(tier)
  if (tier === 1) return `练气${stage}层`
  if (tier === 8) return `飞升${stage}阶`
  if (tier === 9) return `混元${stage}阶`
  return `${tierName}${STAGE_NAMES[(stage - 1) % 3] || ''}`
}
function formatNum(n: number): string {
  if (!n && n !== 0) return '0'
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万'
  return Math.floor(n).toString()
}

// ============ 视图切换 ============
function goLobby() {
  teamStore.currentPanel = 'lobby'
  fetchRooms()
  fetchRealms()
}
function goRealms() {
  teamStore.currentPanel = 'realms'
  fetchRealms()
}
function goShop() {
  teamStore.currentPanel = 'shop'
  stopPolling()
  fetchRealms()  // 刷新顶栏的积分显示
}
function onShopUpdated() {
  fetchRealms()  // 购买后刷新积分
}
function goCreate() {
  teamStore.currentPanel = 'create'
  fetchRealms()
}
function backToLobby() {
  teamStore.reset()
  teamStore.currentPanel = 'lobby'
  fetchRooms()
  fetchRealms()
}
async function goHistory() {
  teamStore.currentPanel = 'history'
  stopPolling()
  historyLoading.value = true
  try {
    const api = useApi()
    const res: any = await api('/team/battles', { query: { limit: 30 } })
    if (res.code === 200) {
      teamStore.battleHistory = res.data.battles
    } else {
      alert(res.message || '加载失败')
    }
  } catch (e: any) {
    console.error('fetch battle history error:', e)
    alert(e?.data?.message || '加载失败')
  } finally {
    historyLoading.value = false
  }
}
async function openHistoryDetail(battleId: number) {
  try {
    const api = useApi()
    const res: any = await api(`/team/battles/${battleId}`)
    if (res.code === 200) {
      teamStore.historyDetail = res.data
      showDetailLogs.value = false
      teamStore.currentPanel = 'history-detail'
    } else {
      alert(res.message || '加载失败')
    }
  } catch (e: any) {
    console.error('fetch battle detail error:', e)
    alert(e?.data?.message || '加载失败')
  }
}
function backToHistory() {
  teamStore.historyDetail = null
  teamStore.currentPanel = 'history'
}
function formatTime(ts: string | Date): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} 天前`
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`
}

function handleClose() {
  stopPolling()
  emit('close')
}

// ============ 数据请求 ============
async function fetchRooms() {
  try {
    const api = useApi()
    const query: any = {}
    if (filterRealm.value) query.secret_realm_id = filterRealm.value
    if (filterDifficulty.value) query.difficulty = filterDifficulty.value
    if (onlyAvailable.value) query.only_available = 'true'
    const res: any = await api('/team/rooms', { query })
    if (res.code === 200) teamStore.lobbyRooms = res.data.rooms
  } catch (e) {
    console.error('fetchRooms error:', e)
  }
}

async function fetchRealms() {
  try {
    const api = useApi()
    const res: any = await api('/team/realms')
    if (res.code === 200) {
      teamStore.realms = res.data.realms
      teamStore.playerInfo = res.data.player
    }
  } catch (e) {
    console.error('fetchRealms error:', e)
  }
}

async function createRoom() {
  if (!selectedRealm.value) return
  loading.value = true
  try {
    const api = useApi()
    const res: any = await api('/team/create', {
      method: 'POST',
      body: { secret_realm_id: selectedRealm.value, difficulty: selectedDifficulty.value },
    })
    if (res.code === 200) {
      teamStore.setRoom(res.data.room)
      startRoomPolling()
    } else {
      alert(res.message || '创建失败')
    }
  } catch (e: any) {
    alert(e?.data?.message || '创建失败')
  } finally {
    loading.value = false
  }
}

async function joinRoom(roomId: number) {
  loading.value = true
  try {
    const api = useApi()
    const res: any = await api('/team/join', { method: 'POST', body: { room_id: roomId } })
    if (res.code === 200) {
      teamStore.setRoom(res.data.room)
      startRoomPolling()
    } else {
      alert(res.message || '加入失败')
    }
  } catch (e: any) {
    alert(e?.data?.message || '加入失败')
  } finally {
    loading.value = false
  }
}

async function leaveRoom() {
  loading.value = true
  try {
    const api = useApi()
    await api('/team/leave', { method: 'POST' })
    teamStore.reset()
    stopRoomPolling()
    fetchRooms()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function toggleReady() {
  try {
    const api = useApi()
    const res: any = await api('/team/ready', { method: 'POST', body: { ready: !meReady.value } })
    if (res.code === 200) teamStore.setRoom(res.data.room)
  } catch (e) {
    console.error(e)
  }
}

async function kickMember(charId: number) {
  if (!confirm('确定要踢出该成员？')) return
  try {
    const api = useApi()
    const res: any = await api('/team/kick', { method: 'POST', body: { character_id: charId } })
    if (res.code === 200) teamStore.setRoom(res.data.room)
    else alert(res.message)
  } catch (e: any) {
    alert(e?.data?.message || '踢出失败')
  }
}

async function startBattle() {
  if (loading.value) return
  loading.value = true
  try {
    const api = useApi()
    const res: any = await api('/team/start', { method: 'POST' })
    if (res.code === 200) {
      pendingBattleData.value = res.data
      stopRoomPolling()
      // 开始播放日志
      teamStore.currentPanel = 'battle'
      displayedLogs.value = []
      battleLogIndex.value = 0
      totalLogs.value = res.data.logs.length
      playBattleLogs(res.data)
    } else {
      alert(res.message || '战斗失败')
    }
  } catch (e: any) {
    alert(e?.data?.message || '战斗失败')
  } finally {
    loading.value = false
  }
}

// 日志播放（每 150ms 一条，最多同时显示 50 条）
function playBattleLogs(data: any) {
  const logs = data.logs
  logPlayTimer.value = setInterval(() => {
    if (battleLogIndex.value >= logs.length) {
      clearInterval(logPlayTimer.value)
      finishBattle(data)
      return
    }
    const toAdd = logs[battleLogIndex.value]
    displayedLogs.value.push(toAdd)
    if (displayedLogs.value.length > 60) displayedLogs.value.shift()
    battleLogIndex.value++
    // 自动滚底
    nextTick(() => {
      if (battleLogBoxRef.value) {
        battleLogBoxRef.value.scrollTop = battleLogBoxRef.value.scrollHeight
      }
    })
  }, 150)
}

function skipToResult() {
  if (logPlayTimer.value) clearInterval(logPlayTimer.value)
  if (pendingBattleData.value) finishBattle(pendingBattleData.value)
}

function finishBattle(data: any) {
  teamStore.battleResult = data
  teamStore.currentPanel = 'result'
  // 刷新玩家信息
  fetchRealms()
}

// ============ 轮询 ============
// P3: 间隔从 3s/2.5s 拉到 8s/5s,且页面不可见时跳过(后台标签页不浪费 Function)
// P5: 大厅 8s → 15s（大厅刷新对实时性要求低，省 ~47% Function 调用）
function startLobbyPolling() {
  stopLobbyPolling()
  fetchRooms()
  fetchRealms()
  lobbyPollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    if (teamStore.currentPanel === 'lobby') fetchRooms()
  }, 15000)
}
function stopLobbyPolling() {
  if (lobbyPollTimer) clearInterval(lobbyPollTimer)
  lobbyPollTimer = null
}
function startRoomPolling() {
  stopRoomPolling()
  roomPollTimer = setInterval(async () => {
    if (!teamStore.currentRoom) return
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const api = useApi()
      const res: any = await api(`/team/room/${teamStore.currentRoom.room_id}`)
      if (res.code === 200) {
        // 如果房间已结束：队长正在走战斗播放（currentPanel 为 'battle'/'result'）时不要打断；
        // 队员则自动拉最近一场战报并切到 result 面板查看
        if (res.data.room.status === 'finished') {
          stopRoomPolling()
          const inBattleFlow = teamStore.currentPanel === 'battle' || teamStore.currentPanel === 'result'
          if (!inBattleFlow) {
            const roomId = teamStore.currentRoom.room_id
            try {
              const latest: any = await api('/team/battles/latest', { query: { room_id: roomId } })
              if (latest.code === 200) {
                teamStore.battleResult = latest.data
                showResultLogs.value = false
                teamStore.currentPanel = 'result'
                teamStore.currentRoom = null
                fetchRealms() // 刷新次数显示
              } else {
                teamStore.reset()
                fetchRooms()
              }
            } catch (e) {
              console.error('fetch latest battle error:', e)
              teamStore.reset()
              fetchRooms()
            }
          }
        } else {
          teamStore.currentRoom = res.data.room
        }
      } else if (res.code === 404) {
        stopRoomPolling()
        teamStore.reset()
      }
    } catch (e) {
      console.error(e)
    }
  }, 5000)
}
function stopRoomPolling() {
  if (roomPollTimer) clearInterval(roomPollTimer)
  roomPollTimer = null
}
function stopPolling() {
  stopLobbyPolling()
  stopRoomPolling()
  if (logPlayTimer.value) clearInterval(logPlayTimer.value)
}

// ============ 计算属性 ============
const userStore = useUserStore()
const myCharId = computed(() => (useGameStore().character?.id ?? 0))
const meReady = computed(() => {
  if (!teamStore.currentRoom) return false
  const me = teamStore.currentRoom.members.find(m => m.character_id === myCharId.value)
  return me?.is_ready || false
})
const isLeader = computed(() => {
  if (!teamStore.currentRoom) return false
  const me = teamStore.currentRoom.members.find(m => m.character_id === myCharId.value)
  return me?.is_leader || false
})
const allReady = computed(() => {
  if (!teamStore.currentRoom) return false
  return teamStore.currentRoom.members.every(m => m.is_leader || m.is_ready)
})

async function restoreMyRoom(): Promise<boolean> {
  try {
    const api = useApi()
    const res: any = await api('/team/my-room')
    if (res.code === 200 && res.data.room && res.data.room.status === 'waiting') {
      teamStore.setRoom(res.data.room)
      return true
    }
  } catch (e) {
    console.error('restoreMyRoom error:', e)
  }
  return false
}

// ============ 打开/关闭监听 ============
watch(() => props.open, async (v) => {
  if (v) {
    fetchRealms()
    const restored = !teamStore.currentRoom ? await restoreMyRoom() : false
    if ((teamStore.currentRoom && teamStore.currentRoom.status === 'waiting') || restored) {
      teamStore.currentPanel = 'room'
      startRoomPolling()
    } else {
      teamStore.currentPanel = 'lobby'
      startLobbyPolling()
    }
  } else {
    stopPolling()
  }
})

watch(() => teamStore.currentPanel, (p) => {
  if (!props.open) return
  if (p === 'lobby') {
    stopRoomPolling()
    startLobbyPolling()
  } else if (p === 'room') {
    stopLobbyPolling()
    if (!roomPollTimer) startRoomPolling()
  } else {
    stopLobbyPolling()
    stopRoomPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.sr-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.sr-modal {
  width: 92%; max-width: 920px; max-height: 90vh;
  background: linear-gradient(180deg, #1a1d24 0%, #15181e 100%);
  border: 1px solid #3a3f4a; border-radius: 8px;
  display: flex; flex-direction: column;
  color: #d8d9de;
  box-shadow: 0 10px 40px rgba(0,0,0,.6);
}
.sr-header {
  display: flex; align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #2b2e36;
}
.sr-title { font-size: 20px; font-weight: bold; color: #e8c58f; letter-spacing: 2px; flex: 1; }
.sr-header-info { display: flex; gap: 20px; font-size: 13px; color: #9ea3ad; margin-right: 15px; }
.sr-header-info b { color: #e8c58f; margin-left: 4px; }
.sr-close {
  background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0 6px;
}
.sr-close:hover { color: #fff; }

.sr-banner {
  padding: 8px 16px; background: #3a2e1a; color: #e8c58f;
  font-size: 13px; cursor: pointer; border-bottom: 1px solid #5a4824;
}
.sr-banner:hover { background: #4a3920; }

.sr-tabs {
  display: flex; gap: 6px; padding: 10px 16px; border-bottom: 1px solid #2b2e36;
}
.sr-tabs button {
  background: transparent; border: 1px solid #3a3f4a; color: #9ea3ad;
  padding: 6px 14px; cursor: pointer; border-radius: 4px; font-size: 13px;
}
.sr-tabs button.active { background: #2b2e36; color: #e8c58f; border-color: #5a4824; }
.sr-tabs button.create-btn { margin-left: auto; background: #3a4a2e; color: #a3c972; border-color: #5a7346; }
.sr-tabs button.create-btn:hover { background: #4a5a3c; }

.sr-panel {
  flex: 1; overflow-y: auto; padding: 16px;
}

.sr-toolbar {
  display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;
}
.sr-toolbar select, .sr-toolbar button {
  background: #23262e; color: #d8d9de; border: 1px solid #3a3f4a;
  padding: 5px 10px; border-radius: 4px; font-size: 13px; cursor: pointer;
}
.sr-toolbar label { font-size: 13px; color: #9ea3ad; display: flex; align-items: center; gap: 5px; }
.sr-toolbar .refresh-btn:hover { background: #2f3340; }

.sr-empty {
  padding: 40px; text-align: center; color: #6a6f78; font-size: 14px;
}

.sr-room-list { display: flex; flex-direction: column; gap: 8px; }
.sr-room-card {
  display: flex; align-items: center; padding: 12px 14px;
  background: #1f2229; border: 1px solid #2b2e36; border-radius: 6px;
  transition: border-color .15s;
}
.sr-room-card:hover { border-color: #4a4f5a; }
.sr-room-card.highlight { border-color: #e8c58f; background: #2a2419; }
.sr-room-card.disabled { opacity: .5; }
.room-info { flex: 1; }
.room-title { font-size: 15px; color: #d8d9de; margin-bottom: 4px; }
.sect-badge {
  display: inline-block; padding: 1px 6px; background: #5a4824; color: #e8c58f;
  font-size: 11px; border-radius: 3px; margin-right: 6px;
}
.room-meta { font-size: 12px; color: #9ea3ad; }
.room-meta b { color: #d8d9de; }
.leader-realm, .leader-sect { margin-left: 8px; color: #6a6f78; }
.room-actions { display: flex; gap: 10px; align-items: center; }
.room-count { color: #9ea3ad; font-size: 13px; }
.join-btn {
  background: #3a4a2e; color: #a3c972; border: 1px solid #5a7346;
  padding: 5px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;
}
.join-btn:hover:not(:disabled) { background: #4a5a3c; }
.join-btn:disabled { background: #23262e; color: #5a5f6a; border-color: #2b2e36; cursor: not-allowed; }

.sr-realms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.realm-card {
  background: #1f2229; border: 1px solid #2b2e36; border-radius: 6px; padding: 12px;
}
.realm-card.locked { opacity: .6; }
.realm-title { font-size: 16px; color: #e8c58f; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.realm-id { font-size: 11px; color: #6a6f78; background: #2b2e36; padding: 1px 5px; border-radius: 3px; }
.realm-elem { font-size: 12px; }
.realm-lock { font-size: 11px; color: #b85c5c; }
.realm-desc { font-size: 12px; color: #9ea3ad; margin-bottom: 8px; line-height: 1.4; }
.realm-difficulties { display: flex; flex-direction: column; gap: 4px; }
.difficulty-row {
  display: flex; gap: 10px; font-size: 12px; padding: 4px 0;
  border-top: 1px solid #2b2e36;
}
.difficulty-row:first-child { border-top: none; }
.diff-name { color: #d8d9de; width: 40px; }
.diff-info { color: #6a6f78; flex: 1; }
.diff-clears { color: #a3c972; }
.diff-rating { font-weight: bold; padding: 0 6px; border-radius: 3px; }
.diff-rating.r-S { color: #e8c58f; background: #5a4824; }
.diff-rating.r-A { color: #a3c972; background: #3a4a2e; }
.diff-rating.r-B { color: #56ccf2; background: #234a5a; }

.sr-section-title { color: #e8c58f; margin-bottom: 14px; font-size: 16px; }
.create-form { display: flex; flex-direction: column; gap: 12px; }
.form-label { color: #9ea3ad; font-size: 13px; }
.realm-choose { display: flex; flex-wrap: wrap; gap: 8px; }
.realm-choice, .diff-choice {
  background: #1f2229; color: #d8d9de; border: 1px solid #3a3f4a;
  padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;
}
.realm-choice.active, .diff-choice.active { background: #3a2e1a; border-color: #e8c58f; color: #e8c58f; }
.realm-choice.locked { opacity: .5; cursor: not-allowed; }
.tier-hint { font-size: 11px; color: #6a6f78; margin-left: 4px; }
.lock-hint { margin-left: 4px; }
.form-actions { margin-top: 12px; display: flex; gap: 10px; justify-content: flex-end; }
.btn-primary {
  background: #5a4824; color: #e8c58f; border: 1px solid #e8c58f;
  padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn-primary:hover:not(:disabled) { background: #6a5834; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-cancel {
  background: transparent; color: #9ea3ad; border: 1px solid #3a3f4a;
  padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn-cancel:hover { background: #1f2229; color: #d8d9de; }

.room-header { margin-bottom: 14px; }
.room-header-title { font-size: 18px; color: #e8c58f; font-weight: bold; }
.room-header-sub { font-size: 12px; color: #9ea3ad; margin-top: 3px; }
.member-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;
}
.member-slot { min-height: 110px; }
.member-card, .member-empty {
  background: #1f2229; border: 1px solid #2b2e36; border-radius: 6px;
  padding: 10px; height: 100%;
}
.member-empty {
  display: flex; align-items: center; justify-content: center;
  color: #6a6f78; font-style: italic; font-size: 13px;
  border-style: dashed;
}
.member-main { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.leader-icon { font-size: 16px; }
.member-name { font-size: 15px; color: #d8d9de; font-weight: bold; }
.member-elem { font-size: 11px; margin-left: auto; }
.member-sub { font-size: 12px; color: #9ea3ad; margin-bottom: 6px; }
.member-sect { color: #e8c58f; margin-left: 5px; }
.member-status { display: flex; align-items: center; gap: 8px; }
.ready { font-size: 12px; padding: 2px 8px; border-radius: 3px; }
.ready.ok { color: #a3c972; background: #3a4a2e; }
.ready.wait { color: #f2c94c; background: #3a3419; }
.ready.leader { color: #e8c58f; background: #5a4824; }
.kick-btn {
  margin-left: auto; background: #4a2e2e; color: #eb7474; border: 1px solid #6a4444;
  padding: 2px 8px; border-radius: 3px; font-size: 11px; cursor: pointer;
}
.kick-btn:hover { background: #6a3e3e; }

.room-actions-bar { display: flex; gap: 10px; justify-content: center; }
.btn-ready {
  background: #2f3340; color: #9ea3ad; border: 1px solid #3a3f4a;
  padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn-ready.active { background: #3a4a2e; color: #a3c972; border-color: #5a7346; }
.btn-start { min-width: 160px; }

.battle-panel { display: flex; flex-direction: column; gap: 12px; }
.battle-header { display: flex; justify-content: space-between; color: #e8c58f; }
.battle-progress { color: #9ea3ad; font-size: 12px; }
.battle-log-box {
  flex: 1; min-height: 320px; max-height: 400px; overflow-y: auto;
  background: #15181e; border: 1px solid #2b2e36; padding: 10px; border-radius: 6px;
  font-size: 13px; line-height: 1.6;
}
.battle-log-line { padding: 2px 0; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.battle-log-line .log-text { flex: 1; min-width: 0; }
.battle-log-line .log-hp { color: #6a6f78; font-size: 11px; font-weight: normal; white-space: nowrap; flex-shrink: 0; font-style: normal; }
.log-crit { color: #e8c58f; font-weight: bold; }
.log-kill { color: #a3c972; }
.log-death { color: #eb5757; }
.log-system { color: #6a6f78; font-style: italic; }
.log-buff { color: #56ccf2; }

.result-panel { text-align: center; }
.result-rating {
  padding: 30px; margin-bottom: 20px; border-radius: 8px;
  background: #1f2229; border: 2px solid #2b2e36;
}
.rating-big { font-size: 72px; font-weight: bold; margin-bottom: 8px; }
.rating-sub { font-size: 16px; color: #9ea3ad; }
.rating-tip { margin-top: 8px; font-size: 13px; color: #a3c972; }
.sr-fail-protect b { color: #a3c972 !important; }
.result-rating.r-S { border-color: #e8c58f; }
.result-rating.r-S .rating-big { color: #e8c58f; text-shadow: 0 0 20px rgba(232,197,143,.6); }
.result-rating.r-A { border-color: #a3c972; }
.result-rating.r-A .rating-big { color: #a3c972; }
.result-rating.r-B { border-color: #56ccf2; }
.result-rating.r-B .rating-big { color: #56ccf2; }
.result-rating.r-FAIL { border-color: #eb5757; }
.result-rating.r-FAIL .rating-big { color: #eb5757; }

.result-section { margin-bottom: 20px; text-align: left; }
.result-section h3 { color: #e8c58f; margin-bottom: 10px; font-size: 14px; }
.team-buff { padding: 6px 10px; background: #234a5a; color: #56ccf2; margin-bottom: 4px; border-radius: 4px; font-size: 13px; }
.team-buff.none { background: #1f2229; color: #6a6f78; font-style: italic; }
.contribution-list { display: flex; flex-direction: column; gap: 8px; }
.contribution-row {
  background: #1f2229; border: 1px solid #2b2e36; padding: 10px; border-radius: 6px;
}
.c-name { color: #e8c58f; font-weight: bold; margin-bottom: 4px; }
.c-stats { font-size: 12px; color: #9ea3ad; margin-bottom: 4px; }
.c-reward { font-size: 13px; color: #d8d9de; }
.c-reward b { color: #a3c972; }
.c-reward .level-up { color: #56ccf2; margin-left: 2px; }
.c-drops { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
.drop-tag {
  padding: 2px 8px; border: 1px solid #555; border-radius: 3px;
  font-size: 11px; line-height: 1.5;
}
.drop-tag.drop-skill { color: #e8c58f; border-color: #8a6a2c; }
.drop-tag.drop-awaken { color: #d8b4ff; border-color: #6a3d8a; }
.drop-tag.drop-stone { color: #ffb570; border-color: #7a4820; }

.result-actions { margin-top: 20px; }

/* 历史日志 */
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-row {
  display: flex; align-items: center; gap: 12px;
  background: #1f2229; border: 1px solid #2b2e36; border-radius: 6px;
  padding: 10px 14px; cursor: pointer; transition: all .15s;
}
.history-row:hover { border-color: #e8c58f; background: #2a2419; }
.history-row.defeat { opacity: .75; }
.hr-rating {
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: bold; flex-shrink: 0;
  border: 2px solid #2b2e36; background: #15181e;
}
.hr-rating.r-S { color: #e8c58f; border-color: #e8c58f; }
.hr-rating.r-A { color: #a3c972; border-color: #a3c972; }
.hr-rating.r-B { color: #56ccf2; border-color: #56ccf2; }
.hr-rating.r-FAIL { color: #eb5757; border-color: #eb5757; }
.hr-main { flex: 1; min-width: 0; }
.hr-title { font-size: 14px; color: #d8d9de; margin-bottom: 3px; }
.hr-meta { font-size: 12px; color: #9ea3ad; margin-bottom: 2px; }
.hr-time { font-size: 11px; color: #6a6f78; }
.hr-arrow { color: #6a6f78; font-size: 24px; flex-shrink: 0; }
.hr-badge {
  display: inline-block; padding: 1px 6px; background: #2b2e36;
  color: #9ea3ad; font-size: 10px; border-radius: 3px; margin-left: 4px;
}

.history-back {
  display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
  text-align: left;
}
.history-title { font-size: 13px; color: #9ea3ad; }

/* 日志折叠 */
.log-toggle {
  background: transparent; border: none; color: #e8c58f;
  font-size: 14px; cursor: pointer; padding: 0;
  font-weight: bold;
}
.log-toggle:hover { color: #f4d3a5; }
.log-review {
  max-height: 320px; overflow-y: auto;
  background: #15181e; border: 1px solid #2b2e36;
  padding: 10px; border-radius: 6px;
  font-size: 12px; line-height: 1.5;
  margin-top: 6px;
  text-align: left;
}

@media (max-width: 768px) {
  .sr-modal { width: calc(100vw - 12px); max-height: calc(100vh - 12px); }
  .sr-header { padding: 10px 12px; flex-wrap: wrap; gap: 6px; }
  .sr-title { font-size: 16px; letter-spacing: 1px; flex: 1 1 100%; }
  .sr-header-info { font-size: 11px; gap: 10px; margin-right: 0; flex-wrap: wrap; }
  .sr-close { font-size: 20px; position: absolute; top: 6px; right: 6px; }
  .sr-banner { padding: 6px 12px; font-size: 12px; }
  .sr-tabs { padding: 8px 10px; gap: 4px; flex-wrap: wrap; }
  .sr-tabs button { font-size: 12px; padding: 4px 10px; }
  .sr-tabs button.create-btn { margin-left: 0; }
  .sr-panel { padding: 10px; }
  .sr-toolbar { gap: 6px; }
  .sr-toolbar select, .sr-toolbar button, .sr-toolbar label { font-size: 12px; }

  .sr-room-card { padding: 10px; flex-wrap: wrap; gap: 8px; }
  .room-info { flex: 1 1 100%; }
  .room-title { font-size: 13px; }
  .room-meta { font-size: 11px; }
  .room-actions { width: 100%; justify-content: flex-end; }

  .sr-realms-grid { grid-template-columns: 1fr; gap: 8px; }
  .realm-card { padding: 10px; }
  .realm-title { font-size: 14px; }
  .realm-desc { font-size: 11px; }

  .member-grid { grid-template-columns: 1fr; gap: 8px; }
  .member-slot { min-height: 90px; }
  .member-name { font-size: 13px; }
  .member-sub { font-size: 11px; }
  .room-actions-bar { flex-wrap: wrap; gap: 6px; }
  .btn-ready, .btn-start, .btn-primary, .btn-cancel { font-size: 12px; padding: 6px 14px; }
  .btn-start { min-width: 120px; }

  .battle-log-box { font-size: 12px; min-height: 200px; max-height: 300px; }
  .rating-big { font-size: 48px; }
  .rating-sub { font-size: 13px; }
  .result-rating { padding: 20px; }
  .realm-choice, .diff-choice { font-size: 12px; padding: 6px 12px; }
}

/* ==================== 特殊名片：卡片版（同冷月剑魂，由 SPECIAL_BADGE_MAP 触发） ==================== */
.member-card.special-card {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 88% 50%, rgba(200, 180, 255, 0.18) 0%, transparent 55%),
    radial-gradient(circle at 12% 50%, rgba(140, 200, 255, 0.16) 0%, transparent 55%),
    linear-gradient(90deg,
      rgba(20, 22, 50, 0.55) 0%,
      rgba(60, 50, 110, 0.45) 25%,
      rgba(110, 130, 200, 0.35) 50%,
      rgba(60, 50, 110, 0.45) 75%,
      rgba(20, 22, 50, 0.55) 100%) !important;
  background-size: 100% 100%, 100% 100%, 220% 100% !important;
  animation: special-card-bg-flow 5.5s linear infinite, special-card-pulse 2.8s ease-in-out infinite;
}

@keyframes special-card-bg-flow {
  0% { background-position: 88% 50%, 12% 50%, 0% 0; }
  100% { background-position: 88% 50%, 12% 50%, 220% 0; }
}

@keyframes special-card-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 0 1px rgba(200, 190, 255, 0.45),
      0 0 14px rgba(150, 140, 230, 0.4),
      0 0 28px rgba(80, 90, 180, 0.2);
  }
  50% {
    box-shadow:
      inset 0 0 0 1px rgba(230, 220, 255, 0.85),
      0 0 24px rgba(150, 140, 230, 0.75),
      0 0 48px rgba(80, 90, 180, 0.45);
  }
}

.member-card.special-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -60%;
  width: 60%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transform: skewX(-20deg);
  opacity: 0.45;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(180, 200, 255, 0.5) 30%,
    rgba(245, 245, 255, 0.85) 50%,
    rgba(200, 180, 255, 0.5) 70%,
    transparent 100%);
  animation: special-card-shimmer 2.6s ease-in-out infinite;
}

@keyframes special-card-shimmer {
  0% { left: -60%; }
  100% { left: 120%; }
}

.member-card.special-card > * {
  position: relative;
  z-index: 1;
}

.member-card.special-card .member-name {
  background: linear-gradient(90deg,
    #e8e0ff 0%, #b8a8ff 20%, #8c8cff 40%,
    #f0eaff 55%, #b8c8ff 72%, #d4c8ff 88%, #e8e0ff 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: special-card-text-shimmer 2.8s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(200, 180, 255, 0.7));
}

@keyframes special-card-text-shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}

.special-card-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #6e6bff 0%, #b8a8ff 25%, #e8e0ff 50%, #b8a8ff 75%, #6e6bff 100%);
  background-size: 220% 100%;
  border-radius: 3px;
  animation: special-card-badge-shine 2.4s linear infinite;
  box-shadow: 0 0 6px rgba(180, 168, 255, 0.75), 0 0 14px rgba(110, 107, 255, 0.5);
  vertical-align: middle;
  letter-spacing: 2px;
  text-shadow: 0 0 4px rgba(80, 70, 180, 0.6);
}

@keyframes special-card-badge-shine {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}
/* ==================== 特殊名片卡片版（吴彦祖/魚魚魚/僵尸/郭峰，由 getSpecialVariant 触发） ==================== */

/* ── 吴彦祖1号：影帝（彩虹） ── */
.member-card.wuyanzu-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(90deg,
      rgba(255, 80, 220, 0.18) 0%,
      rgba(160, 100, 255, 0.14) 25%,
      rgba(80, 180, 255, 0.14) 50%,
      rgba(80, 255, 200, 0.10) 75%,
      rgba(255, 200, 80, 0.08) 100%) !important;
  background-size: 220% 100% !important;
  animation: wuyanzu-card-bg-flow 4.5s linear infinite, wuyanzu-card-pulse 2.4s ease-in-out infinite;
}
@keyframes wuyanzu-card-bg-flow {
  0% { background-position: 0% 0; }
  100% { background-position: 220% 0; }
}
@keyframes wuyanzu-card-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(200, 140, 255, 0.45), 0 0 14px rgba(180, 100, 255, 0.45), 0 0 28px rgba(255, 80, 200, 0.22); }
  50%      { box-shadow: inset 0 0 0 1px rgba(230, 180, 255, 0.85), 0 0 24px rgba(180, 100, 255, 0.9), 0 0 48px rgba(255, 80, 200, 0.55); }
}
.member-card.wuyanzu-card::before {
  content: ''; position: absolute; top: 0; left: -60%; width: 60%; height: 100%; z-index: 0; pointer-events: none;
  transform: skewX(-18deg); opacity: 0.45;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 130, 240, 0.7) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(140, 230, 255, 0.7) 70%, transparent 100%);
  animation: special-card-shimmer 2.2s ease-in-out infinite;
}
.member-card.wuyanzu-card > * { position: relative; z-index: 1; }
.member-card.wuyanzu-card .member-name {
  background: linear-gradient(90deg, #ff5cd2 0%, #c66bff 18%, #6bb3ff 36%, #6bffc1 54%, #ffe26b 72%, #ff8c5c 86%, #ff5cd2 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  animation: wuyanzu-card-text-shimmer 2.4s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(255, 100, 230, 0.55));
}
@keyframes wuyanzu-card-text-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }
.wuyanzu-card-bolt {
  position: absolute; top: -10px; right: 8px; font-size: 16px; line-height: 1; z-index: 5; pointer-events: none;
  filter: drop-shadow(0 0 5px rgba(255, 220, 80, 0.95)) drop-shadow(0 0 10px rgba(180, 100, 255, 0.6));
  animation: wuyanzu-card-bolt-zap 1.4s ease-in-out infinite;
}
@keyframes wuyanzu-card-bolt-zap {
  0%, 100% { transform: rotate(-15deg) scale(1); opacity: 0.9; }
  50% { transform: rotate(15deg) scale(1.28); opacity: 1; }
}
.wuyanzu-card-badge {
  display: inline-block; margin-left: 6px; padding: 1px 7px; font-size: 10px; font-weight: 700; color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #ff5cd2 0%, #c66bff 35%, #6bb3ff 70%, #ff5cd2 100%);
  background-size: 220% 100%; border-radius: 3px;
  animation: wuyanzu-card-badge-shine 2.2s linear infinite;
  box-shadow: 0 0 6px rgba(255, 100, 230, 0.7), 0 0 12px rgba(120, 100, 255, 0.4);
  vertical-align: middle; letter-spacing: 1px; text-shadow: 0 0 4px rgba(120, 60, 180, 0.6);
}
@keyframes wuyanzu-card-badge-shine { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }

/* ── 魚魚魚：科研家（青蓝） ── */
.member-card.yuyu-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg,
    rgba(80, 220, 255, 0.22) 0%,
    rgba(60, 200, 200, 0.18) 25%,
    rgba(120, 180, 255, 0.18) 50%,
    rgba(100, 240, 200, 0.14) 75%,
    rgba(80, 220, 255, 0.1) 100%) !important;
  background-size: 220% 100% !important;
  animation: yuyu-card-bg-flow 5s linear infinite, yuyu-card-pulse 2.6s ease-in-out infinite;
}
@keyframes yuyu-card-bg-flow { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }
@keyframes yuyu-card-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(140, 210, 255, 0.45), 0 0 14px rgba(80, 200, 255, 0.4), 0 0 28px rgba(60, 220, 200, 0.2); }
  50%      { box-shadow: inset 0 0 0 1px rgba(180, 230, 255, 0.85), 0 0 24px rgba(80, 200, 255, 0.85), 0 0 48px rgba(60, 220, 200, 0.5); }
}
.member-card.yuyu-card::before {
  content: ''; position: absolute; top: 0; left: -60%; width: 60%; height: 100%; z-index: 0; pointer-events: none;
  transform: skewX(-18deg); opacity: 0.45;
  background: linear-gradient(90deg, transparent 0%, rgba(120, 230, 255, 0.65) 30%, rgba(220, 255, 250, 0.95) 50%, rgba(140, 255, 220, 0.65) 70%, transparent 100%);
  animation: special-card-shimmer 2.4s ease-in-out infinite;
}
.member-card.yuyu-card > * { position: relative; z-index: 1; }
.member-card.yuyu-card .member-name {
  background: linear-gradient(90deg, #5cdcff 0%, #6be0d2 22%, #6bb8ff 44%, #8cffd0 66%, #b0e8ff 84%, #5cdcff 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  animation: yuyu-card-text-shimmer 2.6s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(80, 220, 255, 0.55));
}
@keyframes yuyu-card-text-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }
.yuyu-card-bolt {
  position: absolute; top: -10px; right: 8px; font-size: 16px; line-height: 1; z-index: 5; pointer-events: none;
  filter: drop-shadow(0 0 5px rgba(140, 240, 255, 0.95)) drop-shadow(0 0 10px rgba(100, 240, 200, 0.6));
  animation: yuyu-card-bolt-bob 2.4s ease-in-out infinite;
}
@keyframes yuyu-card-bolt-bob {
  0%, 100% { transform: translateY(0) rotate(-6deg) scale(1); opacity: 0.95; }
  50% { transform: translateY(-3px) rotate(8deg) scale(1.14); opacity: 1; }
}
.yuyu-card-badge {
  display: inline-block; margin-left: 6px; padding: 1px 7px; font-size: 10px; font-weight: 700; color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #4ec8ff 0%, #5cd8c0 35%, #6bb8ff 70%, #4ec8ff 100%);
  background-size: 220% 100%; border-radius: 3px;
  animation: yuyu-card-badge-shine 2.4s linear infinite;
  box-shadow: 0 0 6px rgba(80, 220, 255, 0.7), 0 0 12px rgba(100, 240, 200, 0.4);
  vertical-align: middle; letter-spacing: 1px; text-shadow: 0 0 4px rgba(40, 80, 140, 0.6);
}
@keyframes yuyu-card-badge-shine { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }

/* ── 僵尸仙人：姜尸头子（绿紫） ── */
.member-card.jiangshi-card {
  position: relative;
  overflow: hidden;
  border-color: rgba(154, 220, 92, 0.45) !important;
  background:
    radial-gradient(circle at 11% 18%, rgba(255, 224, 92, 0.26) 0 10px, transparent 11px),
    repeating-linear-gradient(90deg, rgba(60, 128, 46, 0.2) 0 26px, rgba(40, 92, 38, 0.2) 26px 52px),
    linear-gradient(90deg, rgba(34, 76, 30, 0.9) 0%, rgba(24, 48, 31, 0.88) 35%, rgba(46, 28, 66, 0.72) 72%, rgba(18, 16, 24, 0.8) 100%) !important;
  background-size: 100% 100%, 104px 100%, 220% 100% !important;
  animation: jiangshi-card-bg-flow 5.2s linear infinite, jiangshi-card-pulse 2.8s ease-in-out infinite;
}
@keyframes jiangshi-card-bg-flow {
  0% { background-position: 0 0, 0 0, 0% 0; }
  100% { background-position: 0 0, 104px 0, 220% 0; }
}
@keyframes jiangshi-card-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(185, 245, 92, 0.45), 0 0 14px rgba(96, 210, 76, 0.42), 0 0 28px rgba(136, 78, 190, 0.2); }
  50%      { box-shadow: inset 0 0 0 1px rgba(220, 255, 104, 0.82), 0 0 28px rgba(122, 255, 82, 0.78), 0 0 52px rgba(146, 84, 220, 0.5); }
}
.member-card.jiangshi-card > * { position: relative; z-index: 1; }
.member-card.jiangshi-card .member-name {
  background: linear-gradient(90deg, #a7ff5c 0%, #f6ff78 18%, #7fe84c 36%, #b87cff 56%, #f0ff80 76%, #a7ff5c 100%);
  background-size: 240% 100%;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  animation: jiangshi-card-text-shimmer 2.4s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 6px rgba(142, 255, 82, 0.62)) drop-shadow(0 0 12px rgba(162, 92, 220, 0.36));
}
@keyframes jiangshi-card-text-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 240% 0; } }
.jiangshi-card-bolt {
  position: absolute; top: -10px; right: 8px; font-size: 17px; line-height: 1; z-index: 5; pointer-events: none;
  filter: drop-shadow(0 0 5px rgba(172, 255, 92, 0.95)) drop-shadow(0 0 10px rgba(142, 84, 220, 0.6));
  animation: jiangshi-card-bolt-lurch 1.6s ease-in-out infinite;
}
@keyframes jiangshi-card-bolt-lurch {
  0%, 100% { transform: translateY(0) rotate(-8deg) scale(1); opacity: 0.92; }
  50% { transform: translateY(1px) rotate(10deg) scale(1.16); opacity: 1; }
}
.jiangshi-card-badge {
  display: inline-block; margin-left: 6px; padding: 1px 7px; font-size: 10px; font-weight: 800; color: #241600;
  -webkit-text-fill-color: #241600;
  background:
    radial-gradient(circle at 18% 45%, #fff56a 0 4px, transparent 5px),
    linear-gradient(90deg, #9cff4e 0%, #fff06a 32%, #82df44 58%, #b878ff 82%, #9cff4e 100%);
  background-size: 120% 100%, 240% 100%;
  border: 1px solid rgba(255, 245, 112, 0.65); border-radius: 3px;
  animation: jiangshi-card-badge-shine 2.3s linear infinite;
  box-shadow: 0 0 7px rgba(142, 255, 82, 0.72), 0 0 14px rgba(142, 84, 220, 0.42);
  vertical-align: middle; letter-spacing: 1px;
}
@keyframes jiangshi-card-badge-shine { 0% { background-position: 0 0, 0% 0; } 100% { background-position: 0 0, 240% 0; } }

/* ── 郭峰：小可爱（粉色胖丁） ── */
.member-card.guofeng-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg,
    rgba(255, 182, 193, 0.20) 0%,
    rgba(255, 192, 203, 0.14) 25%,
    rgba(255, 218, 233, 0.12) 50%,
    rgba(255, 182, 193, 0.10) 75%,
    rgba(255, 105, 180, 0.08) 100%) !important;
  background-size: 220% 100% !important;
  animation: guofeng-card-bg-flow 4s linear infinite, guofeng-card-pulse 2s ease-in-out infinite;
}
@keyframes guofeng-card-bg-flow { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }
@keyframes guofeng-card-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px rgba(255, 182, 193, 0.4), 0 0 14px rgba(255, 105, 180, 0.35), 0 0 28px rgba(255, 182, 193, 0.2); }
  50%      { box-shadow: inset 0 0 0 1px rgba(255, 192, 203, 0.7), 0 0 24px rgba(255, 105, 180, 0.6), 0 0 48px rgba(255, 182, 193, 0.4); }
}
.member-card.guofeng-card::before {
  content: ''; position: absolute; top: 0; left: -60%; width: 60%; height: 100%; z-index: 0; pointer-events: none;
  transform: skewX(-18deg); opacity: 0.4;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 182, 193, 0.8) 30%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 192, 203, 0.8) 70%, transparent 100%);
  animation: special-card-shimmer 2s ease-in-out infinite;
}
.member-card.guofeng-card > * { position: relative; z-index: 1; }
.member-card.guofeng-card .member-name {
  background: linear-gradient(90deg, #ff69b4 0%, #ffb6c1 20%, #ffc0cb 40%, #ff69b4 60%, #ff85c1 80%, #ff69b4 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  animation: guofeng-card-text-shimmer 2.2s linear infinite;
  font-weight: 800;
  filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.5));
}
@keyframes guofeng-card-text-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }
.guofeng-card-music {
  position: absolute; top: -10px; right: 8px; font-size: 15px; line-height: 1; z-index: 5; pointer-events: none;
  filter: drop-shadow(0 0 4px rgba(255, 105, 180, 0.9)) drop-shadow(0 0 8px rgba(255, 182, 193, 0.6));
  animation: guofeng-card-music-bounce 1.2s ease-in-out infinite;
}
@keyframes guofeng-card-music-bounce {
  0%, 100% { transform: translateY(0) rotate(-10deg); opacity: 0.9; }
  50% { transform: translateY(-5px) rotate(10deg); opacity: 1; }
}
.guofeng-card-badge {
  display: inline-block; margin-left: 6px; padding: 1px 7px; font-size: 10px; font-weight: 700; color: #fff;
  -webkit-text-fill-color: #fff;
  background: linear-gradient(90deg, #ff69b4 0%, #ffb6c1 35%, #ffc0cb 70%, #ff69b4 100%);
  background-size: 220% 100%; border-radius: 10px;
  animation: guofeng-card-badge-shine 2s linear infinite;
  box-shadow: 0 0 6px rgba(255, 105, 180, 0.7), 0 0 12px rgba(255, 182, 193, 0.4);
  vertical-align: middle; letter-spacing: 1px; text-shadow: 0 0 4px rgba(200, 40, 100, 0.6);
}
@keyframes guofeng-card-badge-shine { 0% { background-position: 0% 0; } 100% { background-position: 220% 0; } }

</style>
