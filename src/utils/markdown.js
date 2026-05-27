import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from './hljs.js'
import { createLogger } from './logger.js'

const log = createLogger('Markdown')

// 配置 marked v18+ 使用自定义 renderer 实现 highlight.js 集成
// (marked v13+ 移除了 highlight 选项，改用 renderer)
marked.setOptions({
  breaks: true,
  gfm: true,
})

// 自定义 renderer：code 块使用 highlight.js
const renderer = {
  code({ text, lang }) {
    const code = text
    let highlighted = code
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(code, { language: lang }).value
      } catch (e) {
        log.debug('Syntax highlight failed for lang:', lang, e)
      }
    } else if (code.length > 10) {
      try {
        highlighted = hljs.highlightAuto(code).value
      } catch (e) {
        log.debug('Auto highlight failed:', e)
      }
    }
    const langClass = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${langClass}>${highlighted}</code></pre>`
  }
}

marked.use({ renderer })

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'del', 'code', 'pre',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'a', 'img',
    'span', 'div', 'input'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class',
    'target', 'rel', 'type', 'checked', 'disabled',
    'colspan', 'rowspan', 'align'
  ],
  ALLOW_DATA_ATTR: false
}

/**
 * 将 Markdown 文本渲染为安全的 HTML
 * @param {string} text - Markdown 文本
 * @returns {string} 消毒后的安全 HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text) return ''
  try {
    const rawHtml = marked(text)
    return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG)
  } catch (e) {
    log.warn('Markdown render failed, returning raw text:', e)
    return text
  }
}
