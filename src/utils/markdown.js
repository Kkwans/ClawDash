import { marked } from 'marked'
import hljs from './hljs.js'
import { createLogger } from './logger.js'

const log = createLogger('Markdown')

// 配置 marked 使用 highlight.js
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (e) {
        log.debug('Syntax highlight failed for lang:', lang, e)
      }
    }
    try {
      return hljs.highlightAuto(code).value
    } catch (e) {
      log.debug('Auto highlight failed:', e)
    }
    return code
  }
})

/**
 * 将 Markdown 文本渲染为 HTML
 * @param {string} text - Markdown 文本
 * @returns {string} HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text) return ''
  try {
    return marked(text)
  } catch (e) {
    log.warn('Markdown render failed, returning raw text:', e)
    return text
  }
}
