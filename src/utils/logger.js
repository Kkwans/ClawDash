/**
 * 统一日志工具
 * 
 * dev 模式：正常输出到控制台
 * prod 模式：静默（可通过 localStorage 'clawdash_debug' 临时开启）
 * 
 * 用法：
 *   import { createLogger } from '@/utils/logger'
 *   const log = createLogger('Gateway')
 *   log.info('连接成功')  // [Gateway] 连接成功
 *   log.error('失败', e)  // [Gateway] 失败 Error(...)
 */

const IS_PROD = import.meta.env.PROD
const DEBUG_KEY = 'clawdash_debug'

function isDebugEnabled() {
  try {
    return !!localStorage.getItem(DEBUG_KEY)
  } catch {
    return false
  }
}

function shouldLog() {
  return !IS_PROD || isDebugEnabled()
}

function formatTag(tag) {
  return tag ? `[${tag}]` : ''
}

export function createLogger(tag) {
  return {
    log(...args) {
      if (shouldLog()) console.log(formatTag(tag), ...args)
    },
    info(...args) {
      if (shouldLog()) console.info(formatTag(tag), ...args)
    },
    warn(...args) {
      if (shouldLog()) console.warn(formatTag(tag), ...args)
    },
    error(...args) {
      // error 始终输出（生产环境也需要错误追踪）
      console.error(formatTag(tag), ...args)
    },
    debug(...args) {
      if (shouldLog()) console.debug(formatTag(tag), ...args)
    },
  }
}

// 默认实例（无标签）
export default createLogger('ClawDash')
