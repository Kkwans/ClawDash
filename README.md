# 🦞 ClawDash

**OpenClaw 增强版控制台** — 比内置 UI 更简洁，比绿联控制台更强大。

## 特性

- 🎯 **简洁易用** — 全中文界面，新手友好
- 📊 **实时监控** — CPU/内存趋势图，5 秒刷新
- 🤖 **模型管理** — 查看提供商、切换默认模型
- 📡 **渠道管理** — 飞书/QQ 等渠道状态监控
- 💬 **进程管理** — 实时日志、进程状态
- ⚙️ **系统设置** — Token 配置、插件管理
- 🔗 **内置 UI 入口** — 一键跳转到 OpenClaw 内置 Control UI

## 访问地址

| 页面 | 地址 |
|------|------|
| ClawDash | http://\<nas-ip\>:8088/ |
| 内置 Control UI | http://\<nas-ip\>:8088/builtin/ |
| UGreen API | http://\<nas-ip\>:8088/ugreen/api/v1/ |
| 健康检查 | http://\<nas-ip\>:8088/healthz |

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS
- **图表**: Chart.js（实时趋势图）
- **代理**: Nginx（反向代理到 OpenClaw Gateway）
- **API**: 复用绿联 OpenClaw `/ugreen/api/v1/` 端点

## 项目结构

```
ClawDash/
├── src/
│   ├── App.vue          # 主布局（侧边栏 + 内容区）
│   ├── main.js          # 入口
│   ├── style.css        # Tailwind 导入
│   ├── api/
│   │   └── index.js     # API 工具层
│   └── views/
│       ├── Dashboard.vue # 仪表盘（状态 + 监控图表）
│       ├── Models.vue    # 模型管理
│       ├── Channels.vue  # 渠道管理
│       ├── Sessions.vue  # 进程管理
│       └── Settings.vue  # 系统设置
├── nginx.conf           # Nginx 反向代理配置
├── index.html           # 入口 HTML
├── vite.config.js       # Vite 配置
└── package.json
```

## 开发

```bash
npm install
npm run dev
```

## 构建 & 部署

```bash
npm run build
# 构建产物在 dist/，部署到 NAS 的 Nginx 容器
```

## 架构

```
浏览器 (:8088)
    │
    ▼
Nginx 容器
    │
    ├── /              → ClawDash（Vue 3 SPA）
    ├── /builtin/*     → OpenClaw Gateway (:19001) 内置 Control UI
    ├── /ugreen/*      → 绿联 OpenClaw (:18799) API
    └── /healthz       → OpenClaw Gateway (:19001) 健康检查
```

## License

MIT
