<template>
  <AdminShell title="充值订单">
    <!-- 发货表单 -->
    <div class="admin-card">
      <h3 style="margin: 0 0 16px;">手动发货</h3>
      <div class="admin-row admin-mb" style="gap: 16px; align-items: flex-start;">
        <!-- 玩家选择：输入道号搜索 -->
        <div style="flex: 1;">
          <label class="admin-label">玩家（道号 / 账号 / ID）</label>
          <input
            v-model="playerQuery"
            class="admin-input"
            placeholder="输入道号、账号或 ID"
            @keyup.enter="lookupPlayer"
            @blur="lookupPlayer"
          />
          <p v-if="lookupErr" class="text-danger" style="font-size: 12px; margin: 4px 0 0;">{{ lookupErr }}</p>
          <p v-else-if="lookedPlayer" class="text-success" style="font-size: 12px; margin: 4px 0 0;">
            ✓ {{ lookedPlayer.name }} (#{{ lookedPlayer.id }}) · Lv.{{ lookedPlayer.level }} · 灵石 {{ Number(lookedPlayer.spirit_stone).toLocaleString() }}
          </p>
        </div>

        <!-- 商品选择 -->
        <div style="flex: 1.5;">
          <label class="admin-label">商品</label>
          <select v-model.number="form.package_id" class="admin-select" @change="onPackageChange">
            <option :value="0">— 请选择 —</option>
            <option v-for="p in enabledPackages" :key="p.id" :value="p.id">
              {{ p.name }} · ¥{{ Number(p.price_rmb).toFixed(0) }}
            </option>
          </select>
        </div>

        <!-- 数量（仅一次性 / 道具支持，月卡 disabled = 1） -->
        <div style="width: 130px;">
          <label class="admin-label">数量</label>
          <input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="99"
            class="admin-input"
            :disabled="!quantitySupported"
            :title="quantitySupported ? '可批量发货 1-99' : '月卡商品只能发 1 单'"
          />
          <p v-if="form.quantity > 1 && currentPackage" class="text-success" style="font-size: 12px; margin: 4px 0 0;">
            总价 ¥{{ (Number(currentPackage.price_rmb) * form.quantity).toFixed(2) }}
          </p>
        </div>
      </div>

      <div class="admin-form-row">
        <label class="admin-label">备注（可选，500 字内）</label>
        <textarea v-model="form.notes" class="admin-textarea" placeholder="例：微信转账已确认 5 元" />
      </div>

      <div class="admin-row admin-gap-sm">
        <button class="admin-btn" :disabled="submitting || !canSubmit" @click="onDeliver">
          {{ submitting ? '发货中...' : '立即发货' }}
        </button>
        <button class="admin-btn ghost" @click="resetForm">清空</button>
        <span v-if="deliverMsg" :class="deliverOk ? 'text-success' : 'text-danger'" style="margin-left: auto;">
          {{ deliverMsg }}
        </span>
      </div>
      <p class="text-muted" style="font-size: 11px; margin: 8px 0 0; line-height: 1.4;">
        发货成功后数据库即时生效。若玩家在游戏里已打开对应功能（洞府/灵田/秘境/游历），需 F5 或切出再切回该功能才会看到新次数/状态
      </p>
    </div>

    <!-- 订单列表 -->
    <div class="admin-row admin-mb admin-mt">
      <h3 style="margin: 0;">订单流水</h3>
      <select v-model="filter.status" class="admin-select" style="width: 140px;" @change="reload(1)">
        <option value="">全部状态</option>
        <option value="delivered">已发货</option>
        <option value="refunded">已退款</option>
        <option value="cancelled">已取消</option>
      </select>
      <span class="text-dim" style="margin-left: auto;">共 {{ total }} 条</span>
    </div>

    <div v-if="loading" class="admin-loading">加载中...</div>
    <div v-else-if="items.length === 0" class="admin-empty">暂无订单</div>
    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>玩家</th>
            <th>商品</th>
            <th class="num">金额</th>
            <th>状态</th>
            <th>渠道</th>
            <th>发货人</th>
            <th>发货时间</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in items" :key="o.id">
            <td class="text-dim"><code>{{ o.order_no }}</code></td>
            <td>
              <NuxtLink :to="`/admin/players/${o.character_id}`" style="color: var(--primary-hover); text-decoration: none;">
                {{ o.character_name }}
              </NuxtLink>
              <span class="text-muted" style="font-size: 11px; margin-left: 4px;">#{{ o.character_id }}</span>
            </td>
            <td>
              {{ o.package_name }}
              <span v-if="o.package_snapshot?.quantity > 1" class="admin-tag info" style="margin-left: 4px;">×{{ o.package_snapshot.quantity }}</span>
            </td>
            <td class="num">¥{{ Number(o.price_rmb).toFixed(2) }}</td>
            <td><span class="admin-tag" :class="statusClass(o.status)">{{ statusName(o.status) }}</span></td>
            <td class="text-dim">{{ o.pay_channel || '-' }}</td>
            <td class="text-dim">{{ o.delivered_by_username || '-' }}</td>
            <td class="text-dim">{{ fmtDate(o.delivered_at || o.created_at) }}</td>
            <td class="text-muted" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
              {{ o.notes || '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <button class="admin-btn ghost small" :disabled="page <= 1" @click="reload(page - 1)">上一页</button>
      <span class="text-dim">{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span>
      <button class="admin-btn ghost small" :disabled="page * 20 >= total" @click="reload(page + 1)">下一页</button>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin-guard', layout: false })

const route = useRoute()
const api = useAdminApi()

const packages = ref<any[]>([])
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const filter = reactive({ status: '' })

const form = reactive({ character_id: 0, package_id: 0, quantity: 1, notes: '' })
const QUANTITY_SUPPORTED_TYPES = new Set(['one_time_expedition_count', 'one_time_tower_count', 'item_pill'])
const currentPackage = computed(() => packages.value.find(p => p.id === form.package_id))
const quantitySupported = computed(() => currentPackage.value && QUANTITY_SUPPORTED_TYPES.has(currentPackage.value.type))
function onPackageChange() {
  // 切换到月卡商品时，把 quantity 强制设回 1
  if (!quantitySupported.value) form.quantity = 1
}
const playerQuery = ref('')
const lookedPlayer = ref<any>(null)
const lookupErr = ref('')
const submitting = ref(false)
const deliverMsg = ref('')
const deliverOk = ref(false)

const enabledPackages = computed(() => packages.value.filter(p => p.enabled))
const canSubmit = computed(() => form.character_id > 0 && form.package_id > 0 && !!lookedPlayer.value)

function statusName(s: string) {
  return { pending: '待支付', paid: '已支付', delivered: '已发货', refunded: '已退款', cancelled: '已取消' }[s] || s
}
function statusClass(s: string) {
  return { pending: 'warning', paid: 'info', delivered: 'success', refunded: 'danger', cancelled: '' }[s] || ''
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function lookupPlayer() {
  lookedPlayer.value = null
  lookupErr.value = ''
  form.character_id = 0
  const q = (playerQuery.value || '').trim()
  if (!q) return
  try {
    // 1) 纯数字 → 当作 ID 直接查详情
    if (/^\d+$/.test(q)) {
      const res = await api<any>(`/admin/players/${q}`)
      if (res.code === 200) {
        lookedPlayer.value = { ...res.data.character, spirit_stone: res.data.character.spiritStone }
        form.character_id = res.data.character.id
        return
      }
      lookupErr.value = res.message || '未找到玩家'
      return
    }
    // 2) 非数字 → 道号/账号搜索（list 接口 ILIKE）
    const res = await api<any>(`/admin/players?q=${encodeURIComponent(q)}&limit=2`)
    if (res.data.items.length === 0) {
      lookupErr.value = '未找到玩家'
    } else if (res.data.items.length > 1) {
      lookupErr.value = `匹配多个（${res.data.items.length}+ 个），请输入更精确的道号或 ID`
    } else {
      const c = res.data.items[0]
      lookedPlayer.value = c
      form.character_id = c.id
    }
  } catch (e: any) {
    lookupErr.value = '查询失败'
  }
}

async function loadPackages() {
  const res = await api<any>('/admin/packages')
  packages.value = res.data.items
}

async function reload(p: number) {
  loading.value = true
  page.value = p
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' })
    if (filter.status) params.set('status', filter.status)
    const res = await api<any>(`/admin/orders?${params}`)
    items.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.character_id = 0
  form.package_id = 0
  form.quantity = 1
  form.notes = ''
  playerQuery.value = ''
  lookedPlayer.value = null
  lookupErr.value = ''
  deliverMsg.value = ''
}

async function onDeliver() {
  if (!canSubmit.value) return
  const qtyText = form.quantity > 1 ? ` × ${form.quantity}` : ''
  const totalText = form.quantity > 1 && currentPackage.value
    ? `（共 ¥${(Number(currentPackage.value.price_rmb) * form.quantity).toFixed(2)}）`
    : ''
  if (!confirm(`确认给「${lookedPlayer.value.name}」发货「${currentPackage.value?.name}」${qtyText}${totalText}？`)) return

  submitting.value = true
  deliverMsg.value = ''
  try {
    const res = await api<any>('/admin/orders', { method: 'POST', body: { ...form } })
    if (res.code === 200) {
      deliverOk.value = true
      deliverMsg.value = `✓ ${res.message} · ${res.data.order.order_no}`
      resetForm()
      await reload(1)
    } else {
      deliverOk.value = false
      deliverMsg.value = res.message || '发货失败'
    }
  } catch (e: any) {
    deliverOk.value = false
    deliverMsg.value = e?.data?.message || '网络异常'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadPackages()
  // 支持 ?character_id=xxx 预填（玩家详情页跳过来）
  if (route.query.character_id) {
    playerQuery.value = String(route.query.character_id)
    await lookupPlayer()
  }
  await reload(1)
})
</script>
