<template>
  <div class="admin-card">
    <div class="admin-row between admin-mb">
      <h3 style="margin: 0;">GM 操作</h3>
      <button class="admin-btn ghost small" @click="open = !open">{{ open ? '收起' : '展开' }}</button>
    </div>

    <div v-if="open" class="admin-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      <!-- 发货币 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">发/扣货币</p>
        <select v-model="grantCurrency.kind" class="admin-select admin-mb-sm">
          <option value="spirit_stone">灵石</option>
          <option value="cultivation_exp">修为</option>
          <option value="merit">功勋</option>
        </select>
        <input v-model.number="grantCurrency.amount" type="number" class="admin-input admin-mb-sm" placeholder="数量（可负数）" />
        <button class="admin-btn small" :disabled="busy" @click="onGrantCurrency">提交</button>
      </div>

      <!-- 发功法 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">发功法（按品质随机）</p>
        <select v-model="grantSkills.rarity" class="admin-select admin-mb-sm">
          <option value="green">绿（10 池）</option>
          <option value="blue">蓝（11 池）</option>
          <option value="purple">紫（18 池）</option>
          <option value="gold">金（9 池）</option>
          <option value="red">红（4 池）</option>
        </select>
        <input v-model.number="grantSkills.count" type="number" min="1" max="100" class="admin-input admin-mb-sm" placeholder="本数 1-100" />
        <button class="admin-btn small" :disabled="busy" @click="onGrantSkills">发功法</button>
      </div>

      <!-- 发道具 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">发道具</p>
        <input v-model="grantItem.pill_id" class="admin-input admin-mb-sm" placeholder="pill_id 如 enhance_stone_t10" />
        <input v-model.number="grantItem.count" type="number" min="1" class="admin-input admin-mb-sm" placeholder="数量" />
        <button class="admin-btn small" :disabled="busy" @click="onGrantItem">发道具</button>
      </div>

      <!-- 重置每日 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">重置每日次数</p>
        <div class="admin-row admin-gap-sm" style="flex-wrap: wrap;">
          <button class="admin-btn ghost small" :disabled="busy" @click="onReset('sr_daily')">秘境</button>
          <button class="admin-btn ghost small" :disabled="busy" @click="onReset('tower_daily')">通天塔</button>
          <button class="admin-btn ghost small" :disabled="busy" @click="onReset('expedition_today')">游历</button>
        </div>
      </div>

      <!-- 降级 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">降级</p>
        <input v-model.number="levelDown" type="number" min="1" max="200" class="admin-input admin-mb-sm" placeholder="降几级" />
        <button class="admin-btn danger small" :disabled="busy" @click="onLevelDown">降级</button>
      </div>

      <!-- 封号 / 解封 -->
      <div class="admin-card" style="margin: 0;">
        <p class="admin-card-title">封号 / 解封</p>
        <input v-model="banReason" class="admin-input admin-mb-sm" placeholder="封号原因（可选）" />
        <div class="admin-row admin-gap-sm">
          <button class="admin-btn danger small" :disabled="busy || isBanned" @click="onBan">封号</button>
          <button class="admin-btn small" :disabled="busy || !isBanned" @click="onUnban">解封</button>
        </div>
      </div>

      <!-- 发邮件 -->
      <div class="admin-card" style="margin: 0; grid-column: span 2;">
        <p class="admin-card-title">发系统邮件</p>
        <input v-model="mail.title" class="admin-input admin-mb-sm" placeholder="标题（最长 30 字）" maxlength="30" />
        <textarea v-model="mail.content" class="admin-textarea admin-mb-sm" placeholder="正文..." maxlength="2000" rows="3" />
        <div class="admin-row admin-mb-sm" style="gap: 8px;">
          <input v-model.number="mail.attachStone" type="number" class="admin-input" placeholder="附件灵石（可选）" style="flex: 1;" />
          <input v-model="mail.attachPillId" class="admin-input" placeholder="附件 pill_id（可选）" style="flex: 1;" />
          <input v-model.number="mail.attachPillQty" type="number" class="admin-input" placeholder="数量" style="width: 80px;" />
        </div>
        <button class="admin-btn small" :disabled="busy" @click="onSendMail">发送</button>
      </div>
    </div>

    <p v-if="msg" :class="msgOk ? 'text-success' : 'text-danger'" class="admin-mt">{{ msg }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ characterId: number; isBanned: boolean }>()
const emit = defineEmits<{ done: [] }>()
const api = useAdminApi()

const open = ref(true)
const busy = ref(false)
const msg = ref('')
const msgOk = ref(true)

const grantCurrency = reactive({ kind: 'spirit_stone', amount: 0 })
const grantSkills = reactive({ rarity: 'blue', count: 5 })
const grantItem = reactive({ pill_id: '', count: 1 })
const levelDown = ref(1)
const banReason = ref('')
const mail = reactive({ title: '', content: '', attachStone: 0, attachPillId: '', attachPillQty: 0 })

async function call(path: string, body: any, confirmText?: string) {
  if (confirmText && !confirm(confirmText)) return null
  busy.value = true
  msg.value = ''
  try {
    const res = await api<any>(path, { method: 'POST', body })
    msgOk.value = res.code === 200
    msg.value = res.code === 200 ? `✓ ${res.message}` : `✗ ${res.message}`
    if (res.code === 200) emit('done')
    return res
  } catch (e: any) {
    msgOk.value = false
    msg.value = `✗ ${e?.data?.message || '请求失败'}`
    return null
  } finally {
    busy.value = false
  }
}

async function onGrantCurrency() {
  if (!grantCurrency.amount) return alert('数量必填')
  await call(`/admin/players/${props.characterId}/grant-currency`, { ...grantCurrency }, `确认 ${grantCurrency.amount > 0 ? '发放' : '扣除'} ${Math.abs(grantCurrency.amount)} ${grantCurrency.kind}？`)
}
async function onGrantSkills() {
  if (!grantSkills.count) return alert('本数必填')
  await call(`/admin/players/${props.characterId}/grant-skills`, { ...grantSkills }, `确认发 ${grantSkills.count} 本${grantSkills.rarity}功法？`)
}
async function onGrantItem() {
  if (!grantItem.pill_id || !grantItem.count) return alert('pill_id 和数量必填')
  await call(`/admin/players/${props.characterId}/grant-item`, { ...grantItem }, `确认发 ${grantItem.pill_id} ×${grantItem.count}？`)
}
async function onReset(kind: string) {
  await call(`/admin/players/${props.characterId}/reset`, { kind }, `确认重置 ${kind}？`)
}
async function onLevelDown() {
  if (!levelDown.value) return alert('降几级必填')
  await call(`/admin/players/${props.characterId}/level-down`, { levels: levelDown.value }, `确认降 ${levelDown.value} 级？`)
}
async function onBan() {
  await call(`/admin/players/${props.characterId}/ban`, { reason: banReason.value }, `确认封禁该玩家？`)
}
async function onUnban() {
  await call(`/admin/players/${props.characterId}/unban`, {}, `确认解封该玩家？`)
}
async function onSendMail() {
  if (!mail.title || !mail.content) return alert('标题和正文必填')
  const attachments: any[] = []
  if (mail.attachStone > 0) attachments.push({ type: 'spirit_stone', amount: mail.attachStone })
  if (mail.attachPillId && mail.attachPillQty > 0) {
    attachments.push({ type: 'pill', pillId: mail.attachPillId, qty: mail.attachPillQty })
  }
  await call(`/admin/players/${props.characterId}/send-mail`,
    { title: mail.title, content: mail.content, attachments },
    `确认发邮件「${mail.title}」（${attachments.length} 个附件）？`
  )
}
</script>
