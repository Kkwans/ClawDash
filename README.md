# ClawDash — OpenClaw 增强版控制台

> 🦞 比绿联控制台更强大，比内置 Control UI 更简洁的中文管理面板。

## 功能特性

- **📊 仪表盘** — 系统状态总览、CPU/内存实时监控、模型/渠道统计
- **🤖 模型管理** — 查看已配置模型、切换默认模型、Token 容量对比图表
- **📡 渠道管理** — 渠道启用/禁用、配置编辑（JSON 编辑器）
- **💬 会话管理** — 进程状态详情、日志查看/清除
- **⚙️ 系统设置** — Gateway Token 配置、当前配置展示、插件管理
- **⚡ 内置 UI 入口** — 一键跳转内置 Control UI，内置 UI 中有返回按钮

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS 4 + Chart.js
- **部署**: Nginx 反向代理，与 OpenClaw Gateway 共存
- **API**: 复用 UGreen 容器 API（`/ugreen/api/v1/*`）

## 架构

```
用户浏览器 → Nginx (8088)
  ├── /               → ClawDash SPA（Vue 3 静态文件）
  ├── /ugreen/*       → UGreen 容器（18799）API
  ├── /builtin/       → 官方 Gateway（19001）内置 Control UI
  ├── /assets/        → 官方 Gateway 内置 UI 静态资源
  ├── /healthz        → 官方 Gateway 健康检查
  └── /ws             → 官方 Gateway WebSocket
```

## 开发

```bash
# 安装依赖
npm install

# 开发服务器（带 API 代理）
npm run dev

# 构建生产版本
npm run build
```

## 部署

```bash
# 构建
npm run build

# 复制 dist/ 到 NAS
scp -r dist/* Kkwans@192.168.5.110:/volume1/DockerProject/openclaw-official/workspace/console/

# 重启 Nginx
ssh Kkwans@192.168.5.110 "docker restart clawdash-nginx"
```

## 访问

- **增强版控制台**: http://192.168.5.110:8088/
- **内置 Control UI**: http://192.168.5.110:8088/builtin/

## 验收标准

| 编号 | 场景 | 状态 |
|------|------|------|
| AC1 | 访问 8088 端口显示增强版控制台 | ✅ |
| AC2 | 访问 /builtin/ 显示内置 Control UI | ✅ |
| AC3 | 仪表盘显示系统状态 | ✅ |
| AC4 | 模型管理页显示已配置模型 | ✅ |
| AC5 | 渠道管理页显示飞书/QQ 渠道状态 | ✅ |
| AC6 | 全部界面中文 | ✅ |
| AC7 | 移动端基本可用 | ✅ |

## License

MIT
