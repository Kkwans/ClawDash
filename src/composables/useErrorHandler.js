/**
 * useErrorHandler - 统一错误处理 composable
 * 
 * 用法：
 *   const { handleError, withErrorHandling } = useErrorHandler()
 *   
 *   // 方式1：手动处理
 *   try { ... } catch (e) { handleError(e, '加载数据') }
 *   
 *   // 方式2：包装异步函数
 *   const fetchData = withErrorHandling(async () => { ... }, '加载数据')
 */

import { createLogger } from '../utils/logger.js'

const log = createLogger('ErrorHandler')

/**
 * 提取错误信息为用户友好文本
 */
function extractMessage(error) {
  if (!error) return '未知错误'
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.error?.message) return error.error.message
  return String(error)
}

export function useErrorHandler() {
  /**
   * 处理错误：记录日志 + 返回用户友好消息
   * @param {Error|any} error - 错误对象
   * @param {string} context - 错误上下文描述
   * @returns {string} 用户友好的错误消息
   */
  function handleError(error, context = '') {
    const prefix = context ? `[${context}]` : ''
    log.error(prefix, error)
    return extractMessage(error)
  }

  /**
   * 包装异步函数，自动处理错误
   * @param {Function} fn - 异步函数
   * @param {string} context - 错误上下文
   * @returns {Function} 包装后的函数
   */
  function withErrorHandling(fn, context = '') {
    return async (...args) => {
      try {
        return await fn(...args)
      } catch (e) {
        const message = handleError(e, context)
        // 返回 { error, message } 让调用方决定如何展示
        return { error: true, message }
      }
    }
  }

  return {
    handleError,
    withErrorHandling,
    extractMessage,
  }
}
