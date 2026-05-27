/**
 * 数据导出工具
 * 支持 JSON / CSV / TXT 格式导出，自动触发浏览器下载
 */

/**
 * 触发文件下载
 */
function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 生成带时间戳的文件名
 */
function makeFilename(prefix, ext) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}_${ts}.${ext}`
}

/**
 * 导出为 JSON 文件
 */
export function exportJSON(data, prefix = 'export') {
  const content = JSON.stringify(data, null, 2)
  downloadFile(content, makeFilename(prefix, 'json'), 'application/json')
}

/**
 * 导出为 CSV 文件
 * @param {string[]} headers - 列标题
 * @param {Array<string[]>} rows - 数据行
 */
export function exportCSV(headers, rows, prefix = 'export') {
  const escape = (val) => {
    const str = String(val ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ]
  const content = '\uFEFF' + lines.join('\n') // BOM for Excel Chinese support
  downloadFile(content, makeFilename(prefix, 'csv'), 'text/csv;charset=utf-8')
}

/**
 * 导出为 TXT 文件
 */
export function exportTXT(content, prefix = 'export') {
  downloadFile(content, makeFilename(prefix, 'txt'), 'text/plain;charset=utf-8')
}

/**
 * 导出 Gateway 配置
 */
export function exportConfig(configData, configEditor) {
  const data = configData || {}
  const meta = {
    exportedAt: new Date().toISOString(),
    source: 'ClawDash',
    version: 'v0.8'
  }
  // 同时导出 parsed 和 raw
  exportJSON({ meta, config: data, raw: configEditor }, 'gateway-config')
}

/**
 * 导出事件日志
 * @param {Array} events - 事件列表
 * @param {'json'|'csv'} format - 导出格式
 */
export function exportEventLog(events, format = 'json') {
  if (format === 'csv') {
    const headers = ['时间', '事件类型', 'Payload']
    const rows = events.map(e => [
      new Date(e.time).toLocaleString('zh-CN'),
      e.event,
      JSON.stringify(e.payload || {})
    ])
    exportCSV(headers, rows, 'event-log')
  } else {
    exportJSON(events.map(e => ({
      time: new Date(e.time).toISOString(),
      event: e.event,
      payload: e.payload
    })), 'event-log')
  }
}

/**
 * 导出聊天会话
 * @param {object} session - 会话信息
 * @param {Array} messages - 消息列表
 * @param {'json'|'txt'} format - 导出格式
 */
export function exportChat(session, messages, format = 'json') {
  const sessionInfo = {
    key: session?.key || session?.id,
    model: session?.model,
    kind: session?.kind,
    messageCount: messages.length
  }

  if (format === 'txt') {
    const lines = [
      `=== 会话导出 ===`,
      `会话: ${sessionInfo.key}`,
      `模型: ${sessionInfo.model || '-'}`,
      `类型: ${sessionInfo.kind || '-'}`,
      `消息数: ${sessionInfo.messageCount}`,
      `导出时间: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '---',
      ''
    ]
    for (const msg of messages) {
      const role = { user: '👤 用户', assistant: '🤖 Agent', system: '⚙️ 系统', tool: '🔧 工具' }[msg.role] || msg.role
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-CN') : ''
      lines.push(`[${time}] ${role}`)
      lines.push(msg.content || msg.text || '')
      lines.push('')
    }
    exportTXT(lines.join('\n'), `chat-${sessionInfo.key || 'session'}`)
  } else {
    exportJSON({
      meta: { exportedAt: new Date().toISOString(), source: 'ClawDash', version: 'v0.8' },
      session: sessionInfo,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content || m.text || '',
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : null
      }))
    }, `chat-${sessionInfo.key || 'session'}`)
  }
}
