# ClawDash v3.0 — OpenClaw WebSocket 控制台

> 🦞 通过 WebSocket 直连 OpenClaw Gateway 的中文管理面板。

## 功能特性

### 📊 仪表盘
- Gateway 运行状态（健康检查、版本、运行时长）
- 模型配置详情（默认模型、备选模型、Provider 信息）
- 渠道状态 + EventLoop 健康监控
- 活跃会话列表
- Gateway 启停控制

### 🤖 模型管理
- 模型配置（从 config.get 读取）
- 默认模型切换（config.set + baseHash 乐观锁）
- 备用模型设置
- 思考能力配置（关/低/中/高/自动）
- Provider 详情（API 类型、Base URL、模型列表）

### 📡 渠道管理
- 渠道状态（channels.status）
- EventLoop 降级监控
- 插件管理（config.get/set）

### 📦 Skill 管理
- ClawHub 搜索（skills.search）
- Skill 安装（skills.install）
- 本地插件管理（config.get/set）

### ⏰ 定时任务管理
- 任务列表（cron.list）
- 创建/编辑/删除（cron.add/cron.update/cron.remove）
- 立即执行（cron.run）
- 启用/禁用（cron.update + patch.enabled）

### 💬 会话管理
- 会话列表（sessions.list）
- 会话详情（模型、Token 用量、类型）
- Gateway 事件日志查看器（实时事件流）

### ⚙️ 系统设置
- Gateway Token 配置（首次访问自动弹窗）
- 当前配置展示（config.get）
- Gateway 启停控制

### 📱 响应式设计
- 移动端侧边栏折叠
- 所有页面响应式布局
- Tailwind CSS 4 原子化样式

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS 4
- **通信**: WebSocket 直连 Gateway（ws://host:19001/）
- **协议**: Gateway Protocol v4（connect.challenge → connect → req/res）
- **配置读写**: config.get / config.set（baseHash 乐观锁）

## 架构

```
用户浏览器 → Nginx (19001)
  ├── /               → ClawDash SPA（Vue 3 静态文件）
  ├── /console/       → ClawDash SPA（别名）
  ├── /ws             → Gateway WebSocket 代理
  └── /builtin/       → 官方内置 Control UI
```

### Gateway WebSocket 协议

```
连接: new WebSocket("ws://host/ws")
握手: Gateway → connect.challenge({nonce})
      客户端 → connect({token, client, device})
      Gateway → res(ok)
请求: {type:"req", id, method, params}
响应: {type:"res", id, ok, payload|error}
事件: {type:"event", event, payload}
```

### 可用 API 方法

| 方法 | 说明 |
|------|------|
| health | Gateway 健康状态 |
| sessions.list | 会话列表 |
| models.list | 可用模型列表 |
| channels.status | 渠道状态 + eventLoop |
| config.get | 获取完整配置 |
| config.set | 修改配置 (raw + baseHash) |
| cron.list/add/update/remove/run/runs | 定时任务管理 |
| skills.search/install/update | Skill 管理 |

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建生产版本
```

## 部署

```bash
npm run build
tar czf - -C dist . | sshpass -p 'Ncu8117_' ssh Kkwans@192.168.5.110 \
  'cat > /tmp/clawdash.tar.gz' && \
sshpass -p 'Ncu8117_' ssh Kkwans@192.168.5.110 \
  'echo "Ncu8117_" | sudo -S bash -c "cd /volume1/DockerProject/openclaw-official/workspace/console && tar xzf /tmp/clawdash.tar.gz"'
```

## 访问

- **ClawDash**: http://192.168.5.110:19001/console/
- **内置 Control UI**: http://192.168.5.110:19001/builtin/

## License

MIT
