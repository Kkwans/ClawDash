/**
 * OpenClaw Gateway config 工具函数
 * 处理 config.get 返回的 raw 字段可能为 null 的情况
 */

/**
 * 从 config.get 响应中获取 raw JSON 字符串
 * Gateway 某些版本 raw 为 null，需要用 JSON.stringify(parsed)
 */
export function getRawConfig(cfgRes) {
  if (!cfgRes) return null
  if (typeof cfgRes.raw === 'string' && cfgRes.raw.length > 0) return cfgRes.raw
  if (cfgRes.parsed) return JSON.stringify(cfgRes.parsed)
  if (cfgRes.config) return JSON.stringify(cfgRes.config)
  return null
}

/**
 * 从 config.get 响应中获取 hash
 */
export function getConfigHash(cfgRes) {
  return cfgRes?.hash || null
}

/**
 * 从 config.get 响应中获取 parsed 对象
 */
export function getParsedConfig(cfgRes) {
  return cfgRes?.parsed || cfgRes?.config || null
}

/**
 * 标准的 config 更新流程
 * 1. config.get → 获取当前配置
 * 2. modifier(cfg) → 修改配置
 * 3. config.set → 保存配置
 */
export async function updateGatewayConfig(gwRequest, modifier) {
  const cfgRes = await gwRequest('config.get')
  const raw = getRawConfig(cfgRes)
  const hash = getConfigHash(cfgRes)
  if (!raw || !hash) throw new Error('无法获取配置')

  const cfg = JSON.parse(raw)
  modifier(cfg)

  await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
}
