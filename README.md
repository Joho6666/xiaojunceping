# AgentScope

AgentScope 是 AI 项目评估与执行规划平台。当前版本保留 Quick / Expert 前端流程，并新增本地 CLI 连接与 Provider 配置入口。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/settings/ai` 配置 AI 连接。

## AI 连接

- OpenAI / Codex：检测本机 `codex` CLI。
- Anthropic / Claude：检测本机 `claude` CLI。
- Google / Gemini：检测本机 `gemini` CLI。
- API Key：仅发送到服务端内存连接服务，不返回原文，不写入浏览器 `localStorage`。
- 网页 OAuth：当前只有接口占位；Provider 未配置官方 OAuth Client 时会明确返回不可用，不伪造登录。

CLI 凭据由对应 CLI 自己管理，AgentScope 不读取其 OAuth 文件、Cookie 或 Token 文件。

复制 `.env.example` 为 `.env.local` 后填写需要的配置。`USE_MOCK_DATA=true` 只表示使用现有演示数据；真实 Provider 尚未连接时不会自动伪造真实结果。

## 验证

```bash
npm run lint
npm run typecheck
npm run test:reports
npm run build
```

## 当前边界

Provider Connection 当前是本地单用户 MVP，连接数据和 API Key 只存进程内；正式部署前需要接入 Prisma + Supabase PostgreSQL，并使用 `DATABASE_ENCRYPTION_KEY` 加密持久化 OAuth Refresh Token 和 API Key。
# AgentScope

AgentScope 当前包含本地 AI 生态知识库：服务端使用 SQLite 保存已发布的模型、Agent、工具、Skill、MCP 和 GitHub 条目。评估时会先提取需求画像，再执行知识库检索、规则过滤、实时 GitHub 搜索和 Provider 解释。

## 知识库

- 管理页面：`/settings/knowledge`
- 手动同步：`npm run knowledge:sync`
- 测试：`npm run test:knowledge`
- 数据文件：`.agentscope/knowledge.sqlite`，已被 Git 忽略
- 官方源自动发布，社区来源应经过确认后再纳入推荐
- 每次评估允许实时搜索，但报告会区分知识库快照、实时结果和 AI 推测

本地每天自动更新可使用 Windows 任务计划程序执行 `npm run knowledge:sync`。知识库不保存 API Key、OAuth Token 或 CLI 凭据，也不宣称覆盖全部市场工具。
