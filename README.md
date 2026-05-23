# ClawDash — OpenClaw 增强版控制台

> 🦞 比绿联控制台更强大，比内置 Control UI 更简洁的中文管理面板。

## 功能特性

### 📊 仪表盘
- 系统状态总览（运行状态、版本、运行时长、PID）
- CPU/内存实时监控（折线图，5秒刷新，120个数据点）
- 磁盘使用率
- 模型/渠道统计卡片
- Gateway 启停控制

### 🤖 模型管理
- 提供商列表（可展开查看详情）
- 模型列表（显示能力：文本/图片/推理）
- 默认模型切换（主模型 + 备用模型）
- 思考能力配置（关/低/中/高/自动）
- Token 使用统计图表

### 📡 渠道管理
- 渠道列表（启用/禁用开关）
- 插件管理集成（安装/启用/禁用）
- 渠道配置编辑（JSON 编辑器）
- QQ Bot 状态修复

### 📦 Skill 管理
- Skill 列表（区分来源：系统/工作区）
- 启用/禁用/删除（批量操作）
- Skill 搜索（对接 Clawh.ai）
- AI 优化功能
- 目录管理

### ⏰ 定时任务管理
- 任务列表
- 创建/编辑/删除
- 执行历史
- 立即执行
- 帮助提示

### 💬 会话管理
- 会话列表增强
- 会话详情查看
- 日志查看（级别颜色区分、关键词高亮、自动滚动）

### ⚙️ 系统设置
- Gateway Token 配置（首次访问自动弹窗）
- 当前配置展示
- 启停控制

### 📱 移动端适配
- 侧边栏折叠为汉堡菜单
- 所有页面响应式布局
- 卡片列表适配小屏幕

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS 4 + Chart.js
- **部署**: Nginx 反向代理，与 OpenClaw Gateway 共存
- **API**: 复用 UGreen 容器 API（`/api/v1/*`）

## 架构

```
用户浏览器 → Nginx (8088)
  ├── /               → ClawDash SPA（Vue 3 静态文件）
  ├── /api/v1/*       → UGreen 容器（18799）API
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

# 部署到 NAS
tar czf - -C dist . | sshpass -p 'Ncu8117_' ssh Kkwans@192.168.5.110 \
  'cat > /tmp/clawdash.tar.gz' && \
sshpass -p 'Ncu8117_' ssh Kkwans@192.168.5.110 \
  'echo "Ncu8117_" | sudo -S bash -c "cd /volume1/DockerProject/openclaw-official/workspace/console && tar xzf /tmp/clawdash.tar.gz"'
```

## 访问

- **增强版控制台**: http://192.168.5.110:8088/
- **内置 Control UI**: http://192.168.5.110:8088/builtin/

## License

MIT
