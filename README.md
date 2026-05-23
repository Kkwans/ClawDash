# 🦞 ClawDash

**OpenClaw 增强版控制台** — 比内置 UI 更简洁，比绿联控制台更强大。

## 特性

- 🎯 **简洁易用** — 全中文界面，新手友好
- 📊 **监控可视化** — CPU/内存/磁盘实时曲线
- 🤖 **模型管理** — 一键切换模型，Token 使用统计
- 📡 **渠道管理** — 飞书/QQ 等渠道状态监控
- 💬 **会话管理** — 查看活跃会话，重置会话
- ⚙️ **系统设置** — 常用配置，快速修改
- 🔗 **内置 UI 入口** — 一键跳转到 OpenClaw 内置 Control UI

## 技术栈

- Vue 3 + Vite
- Tailwind CSS
- Chart.js（监控图表）

## 访问地址

- 增强版控制台: `http://<your-nas-ip>:6666/`
- 内置 Control UI: `http://<your-nas-ip>:6666/builtin/`

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 部署

构建产物部署到 OpenClaw 实例的 `/console/` 路径。

## License

MIT
