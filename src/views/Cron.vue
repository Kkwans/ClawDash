<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { gwRequest } from '../stores/gateway.js'
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppEmpty from '../components/AppEmpty.vue'
import AppLoading from '../components/AppLoading.vue'
import AppButton from '../components/AppButton.vue'
import AppModal from '../components/AppModal.vue'
import AppBadge from '../components/AppBadge.vue'
import { createLogger } from '../utils/logger.js'
import { useEnterAnim } from '../composables/useEnterAnim.js'

const log = createLogger('Cron')
const { entered } = useEnterAnim()

const jobs = ref([])
const loading = ref(true)
const toastRef = ref(null)
const confirmRef = ref(null)
const saving = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingJob = ref(null)
const editForm = ref({ name: '', scheduleKind: 'cron', scheduleExpr: '', payloadKind: 'systemEvent', payloadText: '', sessionTarget: 'main' })
const showHistoryModal = ref(false)
const historyJob = ref(null)
const historyRuns = ref([])
const historyLoading = ref(false)
const newJob = ref({ name: '', scheduleKind: 'cron', scheduleExpr: '', payloadKind: 'systemEvent', payloadText: '', sessionTarget: 'main' })
const jobFilter = ref('')

function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

async function fetchJobs() {
  loading.value = true
  try {
    const res = await gwRequest('cron.list', { limit: 100 })
    jobs.value = res?.jobs || []
  } catch (e) {
    log.warn('加载定时任务列表失败:', e)
  }
  loading.value = false
}

// 任务搜索过滤
const filteredJobs = computed(() => {
  if (!jobFilter.value) return jobs.value
  const q = jobFilter.value.toLowerCase()
  return jobs.value.filter(j => (j.name || j.id).toLowerCase().includes(q))
})

async function toggleJob(job) {
  try {
    await gwRequest('cron.update', { jobId: job.id, patch: { enabled: !job.enabled } })
    job.enabled = !job.enabled
    showToast(`${job.name || job.id} 已${job.enabled ? '启用' : '禁用'}`)
  } catch (e) {
    showToast(`操作失败: ${e.message}`, 'error')
  }
}

async function runJob(job) {
  try {
    await gwRequest('cron.run', { jobId: job.id })
    showToast(`${job.name || job.id} 已触发执行`)
  } catch (e) {
    showToast(`执行失败: ${e.message}`, 'error')
  }
}

async function deleteJob(job) {
  const ok = await showConfirm(`确定删除任务「${job.name || job.id}」？此操作不可撤销。`)
  if (!ok) return
  try {
    await gwRequest('cron.remove', { jobId: job.id })
    showToast(`${job.name || job.id} 已删除`)
    await fetchJobs()
  } catch (e) {
    showToast(`删除失败: ${e.message}`, 'error')
  }
}

async function createJob() {
  if (!newJob.value.scheduleExpr) { showToast('请填写调度表达式'); return }
  if (!newJob.value.payloadText) { showToast('请填写任务内容'); return }
  saving.value = true
  try {
    const schedule = newJob.value.scheduleKind === 'cron'
      ? { kind: 'cron', expr: newJob.value.scheduleExpr }
      : { kind: 'every', everyMs: parseInt(newJob.value.scheduleExpr) * 60000 }
    const payload = newJob.value.payloadKind === 'systemEvent'
      ? { kind: 'systemEvent', text: newJob.value.payloadText }
      : { kind: 'agentTurn', message: newJob.value.payloadText }
    await gwRequest('cron.add', {
      name: newJob.value.name || undefined,
      schedule,
      payload,
      sessionTarget: newJob.value.sessionTarget
    })
    showToast('任务已创建')
    showCreateModal.value = false
    newJob.value = { name: '', scheduleKind: 'cron', scheduleExpr: '', payloadKind: 'systemEvent', payloadText: '', sessionTarget: 'main' }
    await fetchJobs()
  } catch (e) {
    showToast(`创建失败: ${e.message}`, 'error')
  }
  saving.value = false
}

function startEdit(job) {
  editingJob.value = job
  const s = job.schedule || {}
  const p = job.payload || {}
  editForm.value = {
    name: job.name || '',
    scheduleKind: s.kind || 'cron',
    scheduleExpr: s.expr || (s.everyMs ? String(s.everyMs / 60000) : ''),
    payloadKind: p.kind || 'systemEvent',
    payloadText: p.text || p.message || '',
    sessionTarget: job.sessionTarget || 'main'
  }
  showEditModal.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    const schedule = editForm.value.scheduleKind === 'cron'
      ? { kind: 'cron', expr: editForm.value.scheduleExpr }
      : { kind: 'every', everyMs: parseInt(editForm.value.scheduleExpr) * 60000 }
    const payload = editForm.value.payloadKind === 'systemEvent'
      ? { kind: 'systemEvent', text: editForm.value.payloadText }
      : { kind: 'agentTurn', message: editForm.value.payloadText }
    await gwRequest('cron.update', {
      jobId: editingJob.value.id,
      patch: { name: editForm.value.name || undefined, schedule, payload, sessionTarget: editForm.value.sessionTarget }
    })
    showToast('任务已更新')
    showEditModal.value = false
    await fetchJobs()
  } catch (e) {
    showToast(`更新失败: ${e.message}`, 'error')
  }
  saving.value = false
}

async function showHistory(job) {
  historyJob.value = job
  showHistoryModal.value = true
  historyLoading.value = true
  try {
    const res = await gwRequest('cron.runs', { jobId: job.id, limit: 20 })
    historyRuns.value = res?.runs || []
  } catch (e) {
    showToast(`获取历史失败: ${e.message}`, 'error')
    historyRuns.value = []
  }
  historyLoading.value = false
}

function formatSchedule(schedule) {
  if (!schedule) return '-'
  if (typeof schedule === 'string') return schedule
  if (schedule.kind === 'cron') return `⏱ ${schedule.expr || '-'}`
  if (schedule.kind === 'every') return `🔄 每 ${(schedule.everyMs / 60000).toFixed(0)} 分钟`
  if (schedule.kind === 'at') return `📅 ${new Date(schedule.at).toLocaleString('zh-CN')}`
  return JSON.stringify(schedule)
}

function formatPayload(payload) {
  if (!payload) return '-'
  if (typeof payload === 'string') return payload
  if (payload.kind === 'systemEvent') return `📢 ${(payload.text || '').slice(0, 60)}`
  if (payload.kind === 'agentTurn') return `🤖 ${(payload.message || '').slice(0, 60)}`
  return JSON.stringify(payload).slice(0, 60)
}

const enabledCount = computed(() => jobs.value.filter(j => j.enabled !== false).length)

onMounted(fetchJobs)
</script>

<template>
  <div class="space-y-6">
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 页面标题 -->
    <div class="flex items-center justify-between enter-anim" :class="{ 'is-entered': entered }" style="--delay: 0ms">
      <div>
        <h2 class="text-lg font-bold text-gray-900">定时任务</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理 Cron 定时任务</p>
      </div>
      <div class="flex items-center gap-2">
        <AppButton size="sm" @click="fetchJobs">刷新</AppButton>
        <AppButton size="sm" variant="primary" @click="showCreateModal = true">+ 新建</AppButton>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-3 gap-3 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 80ms">
      <div class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 text-center transition-all">
        <p class="text-2xl font-bold text-blue-600">{{ jobs.length }}</p>
        <p class="text-xs text-gray-500 mt-1">任务总数</p>
      </div>
      <div class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 text-center transition-all">
        <p class="text-2xl font-bold text-emerald-600">{{ enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已启用</p>
      </div>
      <div class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 text-center transition-all">
        <p class="text-2xl font-bold text-gray-400">{{ jobs.length - enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已禁用</p>
      </div>
    </div>

    <!-- 帮助提示 -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 120ms">
      <div class="flex items-start gap-2">
        <span class="text-blue-500 mt-0.5">💡</span>
        <div class="text-xs text-blue-700 space-y-1">
          <p><strong>Cron 表达式：</strong>分 时 日 月 周（如 <code class="bg-blue-100 px-1 rounded">0 */6 * * *</code> = 每 6 小时）</p>
          <p><strong>任务类型：</strong>📢 系统事件（注入文本到主会话）或 🤖 Agent 执行（独立会话运行）</p>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <AppLoading v-if="loading" text="加载任务中..." />

    <!-- 任务列表 -->
    <div v-else class="space-y-3 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <!-- 搜索框（有数据时显示） -->
      <div v-if="jobs.length > 0" class="relative">
        <input v-model="jobFilter" type="search" placeholder="搜索任务..."
          class="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
      </div>

      <!-- 空状态 -->
      <AppEmpty v-if="filteredJobs.length === 0 && jobs.length === 0"
        icon="⏰"
        title="暂无定时任务"
        description="点击「新建」创建第一个定时任务"
      />
      <!-- 无搜索结果 -->
      <div v-else-if="filteredJobs.length === 0 && jobs.length > 0" class="card-accent card-hover text-center py-10 bg-white rounded-2xl border border-gray-200/60">
        <p class="text-sm text-gray-400">未找到匹配「{{ jobFilter }}」的任务</p>
      </div>

      <!-- 任务计数 -->
      <div v-if="filteredJobs.length > 0" class="flex items-center justify-between">
        <p class="text-xs text-gray-400 font-medium">共 {{ jobs.length }} 个任务 · 已筛选 {{ filteredJobs.length }} 个</p>
      </div>

      <!-- 任务卡片列表 -->
      <div v-for="job in filteredJobs" :key="job.id"
        class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 transition-all">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900">{{ job.name || job.id }}</p>
              <AppBadge :type="job.enabled !== false ? 'success' : 'default'" size="sm" dot>
                {{ job.enabled !== false ? '已启用' : '已禁用' }}
              </AppBadge>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
              <span>{{ formatSchedule(job.schedule) }}</span>
              <span>{{ formatPayload(job.payload) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <AppButton size="sm" @click="showHistory(job)">📋</AppButton>
            <AppButton size="sm" @click="startEdit(job)">✏️</AppButton>
            <AppButton size="sm" variant="default" @click="runJob(job)">▶ 执行</AppButton>
            <AppButton size="sm" @click="toggleJob(job)">
              {{ job.enabled !== false ? '禁用' : '启用' }}
            </AppButton>
            <AppButton size="sm" variant="danger" @click="deleteJob(job)">删除</AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <AppModal v-model:visible="showCreateModal" title="新建定时任务" width="500px">
      <form autocomplete="off" @submit.prevent="createJob">
        <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
        <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
        <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">任务名称 <span class="text-gray-400 font-normal">(可选)</span></label>
            <input v-model="newJob.name" placeholder="留空自动生成" autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              aria-label="任务名称"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">调度方式</label>
            <div class="flex gap-2">
              <AppButton size="sm" :variant="newJob.scheduleKind === 'cron' ? 'primary' : 'default'" @click="newJob.scheduleKind = 'cron'">Cron 表达式</AppButton>
              <AppButton size="sm" :variant="newJob.scheduleKind === 'every' ? 'primary' : 'default'" @click="newJob.scheduleKind = 'every'">固定间隔</AppButton>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">
              {{ newJob.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔（分钟）' }}
            </label>
            <input v-model="newJob.scheduleExpr"
              :placeholder="newJob.scheduleKind === 'cron' ? '0 */6 * * *' : '60'"
              autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              :aria-label="newJob.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔分钟数'"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">任务类型</label>
            <div class="flex gap-2">
              <AppButton size="sm" :variant="newJob.payloadKind === 'systemEvent' ? 'primary' : 'default'"
                @click="newJob.payloadKind = 'systemEvent'; newJob.sessionTarget = 'main'">📢 系统事件</AppButton>
              <AppButton size="sm" :variant="newJob.payloadKind === 'agentTurn' ? 'primary' : 'default'"
                @click="newJob.payloadKind = 'agentTurn'; newJob.sessionTarget = 'isolated'">🤖 Agent 执行</AppButton>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">
              {{ newJob.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息' }}
            </label>
            <textarea v-model="newJob.payloadText" rows="3"
              :placeholder="newJob.payloadKind === 'systemEvent' ? '注入到主会话的文本...' : '发送给 Agent 的消息...'"
              autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              :aria-label="newJob.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息'"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all resize-none placeholder:text-gray-300"></textarea>
          </div>
        </div>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="showCreateModal = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createJob">
          {{ saving ? '创建中...' : '创建任务' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 编辑弹窗 -->
    <AppModal v-model:visible="showEditModal" title="编辑定时任务" width="500px">
      <form autocomplete="off" @submit.prevent="saveEdit">
        <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
        <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
        <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">任务名称</label>
            <input v-model="editForm.name" placeholder="可选" autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              aria-label="任务名称"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">调度方式</label>
            <div class="flex gap-2">
              <AppButton size="sm" :variant="editForm.scheduleKind === 'cron' ? 'primary' : 'default'"
                @click="editForm.scheduleKind = 'cron'">Cron 表达式</AppButton>
              <AppButton size="sm" :variant="editForm.scheduleKind === 'every' ? 'primary' : 'default'"
                @click="editForm.scheduleKind = 'every'">固定间隔</AppButton>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">
              {{ editForm.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔（分钟）' }}
            </label>
            <input v-model="editForm.scheduleExpr"
              autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              :aria-label="editForm.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔分钟数'"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-2">任务类型</label>
            <div class="flex gap-2">
              <AppButton size="sm" :variant="editForm.payloadKind === 'systemEvent' ? 'primary' : 'default'"
                @click="editForm.payloadKind = 'systemEvent'; editForm.sessionTarget = 'main'">📢 系统事件</AppButton>
              <AppButton size="sm" :variant="editForm.payloadKind === 'agentTurn' ? 'primary' : 'default'"
                @click="editForm.payloadKind = 'agentTurn'; editForm.sessionTarget = 'isolated'">🤖 Agent 执行</AppButton>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">
              {{ editForm.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息' }}
            </label>
            <textarea v-model="editForm.payloadText" rows="3"
              autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              :aria-label="editForm.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息'"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all resize-none placeholder:text-gray-300"></textarea>
          </div>
        </div>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="showEditModal = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveEdit">
          {{ saving ? '保存中...' : '保存' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 执行历史弹窗 -->
    <AppModal v-model:visible="showHistoryModal" :title="'执行历史 — ' + (historyJob?.name || historyJob?.id || '')" width="500px">
      <div v-if="historyLoading" class="text-center py-8">
        <div class="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
      </div>
      <div v-else-if="historyRuns.length === 0" class="text-center py-8">
        <p class="text-sm text-gray-400">暂无执行记录</p>
      </div>
      <div v-else class="space-y-2 max-h-80 overflow-y-auto">
        <div v-for="run in historyRuns" :key="run.id || run.runId"
          class="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <AppBadge :type="run.status === 'completed' || run.ok ? 'success' : run.status === 'failed' || run.error ? 'danger' : 'warning'" size="sm">
              {{ run.status || (run.ok ? '成功' : '失败') }}
            </AppBadge>
            <span class="text-xs text-gray-400">
              {{ run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN') : run.createdAt ? new Date(run.createdAt).toLocaleString('zh-CN') : '-' }}
            </span>
          </div>
          <p v-if="run.error" class="text-xs text-red-500 mt-1">{{ run.error }}</p>
          <p v-if="run.summary" class="text-xs text-gray-600 mt-1">{{ run.summary }}</p>
        </div>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="showHistoryModal = false">关闭</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
/* Cron 使用 shared-animations.css 中的 .enter-anim / .is-entered */
</style>