<script setup>
import { ref, computed, onMounted } from 'vue'
import { gwRequest } from '../stores/gateway.js'
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppEmpty from '../components/AppEmpty.vue'
import AppLoading from '../components/AppLoading.vue'
import { createLogger } from '../utils/logger.js'

const log = createLogger('Cron')

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
  const ok = await showConfirm(`确定要删除任务 "${job.name || job.id}" 吗？`)
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
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">定时任务</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理 Cron 定时任务</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="fetchJobs" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          刷新
        </button>
        <button @click="showCreateModal = true" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          + 新建
        </button>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ jobs.length }}</p>
        <p class="text-xs text-gray-500 mt-1">任务总数</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已启用</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-gray-400">{{ jobs.length - enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已禁用</p>
      </div>
    </div>

    <!-- 帮助提示 -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
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

    <!-- 空状态 -->
    <AppEmpty v-else-if="jobs.length === 0"
      icon="⏰"
      title="暂无定时任务"
      description="点击「新建」创建第一个定时任务"
    />

    <!-- 任务列表 -->
    <div v-else class="space-y-2">
      <div v-for="job in jobs" :key="job.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900">{{ job.name || job.id }}</p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="job.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                <span class="w-1.5 h-1.5 rounded-full" :class="job.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
                {{ job.enabled !== false ? '已启用' : '已禁用' }}
              </span>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
              <span>{{ formatSchedule(job.schedule) }}</span>
              <span>{{ formatPayload(job.payload) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="showHistory(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all">
              📋
            </button>
            <button @click="startEdit(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all">
              ✏️
            </button>
            <button @click="runJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              ▶ 执行
            </button>
            <button @click="toggleJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              :class="job.enabled !== false
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'">
              {{ job.enabled !== false ? '禁用' : '启用' }}
            </button>
            <button @click="deleteJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="showCreateModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-base font-semibold text-gray-800">新建定时任务</h3>
            <button @click="showCreateModal = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">任务名称</label>
              <input v-model="newJob.name" placeholder="可选，留空自动生成" autocomplete="off"
                aria-label="任务名称"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">调度方式</label>
              <div class="flex gap-2">
                <button @click="newJob.scheduleKind = 'cron'"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  :class="newJob.scheduleKind === 'cron' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  Cron 表达式
                </button>
                <button @click="newJob.scheduleKind = 'every'"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  :class="newJob.scheduleKind === 'every' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  固定间隔
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">
                {{ newJob.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔（分钟）' }}
              </label>
              <input v-model="newJob.scheduleExpr"
                :placeholder="newJob.scheduleKind === 'cron' ? '0 */6 * * *' : '60'"
                autocomplete="off"
                :aria-label="newJob.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔分钟数'"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">任务类型</label>
              <div class="flex gap-2">
                <button @click="newJob.payloadKind = 'systemEvent'; newJob.sessionTarget = 'main'"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  :class="newJob.payloadKind === 'systemEvent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  📢 系统事件
                </button>
                <button @click="newJob.payloadKind = 'agentTurn'; newJob.sessionTarget = 'isolated'"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  :class="newJob.payloadKind === 'agentTurn' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  🤖 Agent 执行
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">
                {{ newJob.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息' }}
              </label>
              <textarea v-model="newJob.payloadText" rows="3"
                :placeholder="newJob.payloadKind === 'systemEvent' ? '注入到主会话的文本...' : '发送给 Agent 的消息...'"
                autocomplete="off"
                :aria-label="newJob.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息'"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-gray-200">
            <button @click="showCreateModal = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button @click="createJob" :disabled="saving || !newJob.payloadText"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="showEditModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-base font-semibold text-gray-800">编辑定时任务</h3>
            <button @click="showEditModal = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">任务名称</label>
              <input v-model="editForm.name" placeholder="可选" autocomplete="off" aria-label="任务名称" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">调度方式</label>
              <div class="flex gap-2">
                <button @click="editForm.scheduleKind = 'cron'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" :class="editForm.scheduleKind === 'cron' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">Cron 表达式</button>
                <button @click="editForm.scheduleKind = 'every'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" :class="editForm.scheduleKind === 'every' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">固定间隔</button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">{{ editForm.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔（分钟）' }}</label>
              <input v-model="editForm.scheduleExpr" autocomplete="off" :aria-label="editForm.scheduleKind === 'cron' ? 'Cron 表达式' : '间隔分钟数'" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">任务类型</label>
              <div class="flex gap-2">
                <button @click="editForm.payloadKind = 'systemEvent'; editForm.sessionTarget = 'main'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" :class="editForm.payloadKind === 'systemEvent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">📢 系统事件</button>
                <button @click="editForm.payloadKind = 'agentTurn'; editForm.sessionTarget = 'isolated'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" :class="editForm.payloadKind === 'agentTurn' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">🤖 Agent 执行</button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">{{ editForm.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息' }}</label>
              <textarea v-model="editForm.payloadText" rows="3" autocomplete="off" :aria-label="editForm.payloadKind === 'systemEvent' ? '事件文本' : 'Agent 消息'" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-gray-200">
            <button @click="showEditModal = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button @click="saveEdit" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 执行历史弹窗 -->
    <Teleport to="body">
      <div v-if="showHistoryModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" @click="showHistoryModal = false"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-base font-semibold text-gray-800">执行历史 — {{ historyJob?.name || historyJob?.id }}</h3>
            <button @click="showHistoryModal = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <div v-if="historyLoading" class="text-center py-8">
              <div class="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            </div>
            <div v-else-if="historyRuns.length === 0" class="text-center py-8">
              <p class="text-sm text-gray-400">暂无执行记录</p>
            </div>
            <div v-else class="space-y-2">
              <div v-for="run in historyRuns" :key="run.id || run.runId"
                class="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium" :class="run.status === 'completed' || run.ok ? 'text-green-600' : run.status === 'failed' || run.error ? 'text-red-600' : 'text-amber-600'">
                    {{ run.status || (run.ok ? '成功' : '失败') }}
                  </span>
                  <span class="text-xs text-gray-400">{{ run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN') : run.createdAt ? new Date(run.createdAt).toLocaleString('zh-CN') : '-' }}</span>
                </div>
                <p v-if="run.error" class="text-xs text-red-500 mt-1">{{ run.error }}</p>
                <p v-if="run.summary" class="text-xs text-gray-600 mt-1">{{ run.summary }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
