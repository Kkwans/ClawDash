# ClawDash v0.5 — OpenClaw WebSocket 控制台

> 🦞 通过 WebSocket 直连 OpenClaw Gateway 的中文管理面板。

## 功能特性

### 📊 仪表盘
- Gateway 运行状态（健康检查、版本、运行时长）
- 系统状态环形图（事件循环、活跃会话、模型数、渠道数）
- 模型配置详情（默认模型、备选模型、Provider 信息）
- 会话分布图（Doughnut 图表）
- 模型统计卡片
- 渠道状态 + EventLoop 健康监控
- 活跃会话列表
- Gateway 启停控制
- 30 秒自动刷新（无闪烁）

### 🤖 模型管理
- 提供商列表（可展开详情）
- 添加/删除提供商
- 默认模型切换（config.set 真实调用）
- 备用模型设置
- 思考能力配置（关/极低/低/中/高/极高/自适应/最大）
- 推理显示配置（关/开启/流式）
- Provider 详情（API 类型、Base URL、API Key、模型列表）

### 🔌 渠道管理
- 渠道列表 + 状态
- 添加/删除渠道
- 启用/禁用渠道
- 插件安装/卸载/启停

### ⚡ Skill 管理
- 内置 Skill 列表（57 个）
- 搜索 ClawHub
- 安装 Skill
- 删除 Skill
- 插件启停控制

### ⏰ 定时任务
- 任务列表 + 状态
- 创建任务（cron/every/at 三种调度方式）
- 编辑/删除任务
- 执行历史
- 立即执行
- 启用/禁用

### 💬 会话管理
- 会话列表 + 状态标签
- 会话详情（key/model/tokens）
- 重置会话
- 自动刷新

### 🗨️ 聊天页面
- 会话列表
- 消息加载（chat.history）
- 发送消息（chat.send）
- 消息气泡样式

### 📋 日志查看器
- 实时 Gateway 事件流
- 事件颜色区分
- 关键词过滤
- localStorage 持久化（最多 500 条）
- 自动滚动

### ⚙️ 系统设置
- Gateway Token 配置
- 配置查看/编辑（JSON 编辑器）
- Gateway 启停控制
- 健康状态显示

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS
- **通信**: WebSocket (协议 v4)
- **图表**: Chart.js (vue-chartjs)
- **部署**: Nginx + Docker

## API 规范

| 方法 | 参数 | 说明 |
|------|------|------|
| config.get | {} | 获取配置 |
| config.set | {raw, baseHash} | 更新配置 |
| sessions.list | {limit} | 会话列表 |
| sessions.reset | {key} | 重置会话 |
| chat.history | {sessionKey, limit} | 聊天历史 |
| chat.send | {sessionKey, message} | 发送消息 |
| cron.list | {} | 定时任务列表 |
| cron.add | {name, schedule, payload, ...} | 添加任务 |
| cron.update | {jobId, patch} | 更新任务 |
| cron.remove | {jobId} | 删除任务 |
| cron.run | {jobId} | 立即执行 |
| cron.runs | {jobId} | 执行历史 |
| health | {} | 健康检查 |
| skills.search | {query} | 搜索 Skill |
| skills.install | {source, slug} | 安装 Skill |

## 部署

```bash
# 构建
npm run build

# 部署到 NAS
tar czf - -C dist . | sshpass -p 'xxx' ssh user@nas 'cat > /tmp/cd.tar.gz'
sshpass -p 'xxx' ssh user@nas 'sudo bash -c "cd /volume1/DockerProject/openclaw-official/workspace/console && rm -rf assets/* && tar xzf /tmp/cd.tar.gz"'
```

## 更新日志

### v0.5 (2026-05-24)
- 修复 skills.list（使用静态 skills.json）
- 修复 skills.install 参数（{source, slug}）
- 添加 localStorage 日志持久化
- 提取共享 Toast 和 ConfirmDialog 组件
- 统一所有视图的组件样式
- 全量 API 自测通过
