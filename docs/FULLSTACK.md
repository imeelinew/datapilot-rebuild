# 城市视图：全栈运行与讲解

## 架构与范围

```mermaid
flowchart LR
    UI[React / Redux / ECharts] -->|同源 /api| Proxy[Vite 或 Pages Function]
    Proxy --> API[Fastify 自有服务端]
    API --> PG[(PostgreSQL)]
    API --> AI[可选 AI 提供商]
```

服务端负责认证、当前账号角色与状态校验、对象归属、数据校验和持久化。前端菜单和路由限制用于交互体验，不能代替服务端授权。

权限使用四种固定角色：超级管理员、管理员、分析员、普通用户。角色页可编辑名称和说明、查看权限范围；不提供自定义角色与动态授权，服务端会明确拒绝相应写入请求。

城市数据为数据库中的演示种子数据，不是实时城市监测数据。数据源仅支持本服务维护的城市数据集：表和字段通过白名单映射到 SQL，不接受任意 SQL、任意远程数据库地址或数据库凭据。图表、仪表盘和会话是实际持久化的业务资源。

仪表盘复制需将新仪表盘与关联图表放入同一数据库事务；任一写入失败时不应留下半成品。AI 问答由服务端校验会话归属，生成完成后原子写入整轮用户/助手消息，再返回 SSE；前端不再通过两个独立请求写入消息。

未配置 AI_API_KEY 时，助手明确标注使用数据库数据的本地分析降级，不将确定性分析冒充大模型。此版本不提供任意模型生成 SQL 的执行器。

## 本地运行

需要 Node.js 24 和 PostgreSQL 17。以下使用独立空数据库，勿把测试配置指向生产。

1. `npm ci && npm ci --prefix server`
2. 创建开发数据库，复制 `.env.example` 为 `.env`，填写 DATABASE_URL、至少 32 字符的 JWT_SECRET 和三个种子账号密码。
3. 在 shell 导入变量：`set -a; source .env; set +a`。后端从进程环境读取配置，`.env` 不会被上传。
4. `npm run api:migrate && npm run api:seed`
5. 一个终端执行 `npm run api:dev`，另一个终端执行 `npm run dev`。

种子账号：admin（超级管理员）、analyst（分析员）、visitor（普通用户），密码由上述环境变量指定。种子脚本用于初始化演示数据，不是线上账号重置工具。

也可启动容器数据库与 API：在导入上述变量后运行 `docker compose up --build -d`，再运行 `docker compose exec api node dist/seed.js`。Compose 的数据库卷保留数据，初始化密码只用于首次创建数据库；API 仅绑定宿主机回环端口。前端仍可通过 Vite 启动。数据库密码包含 URL 保留字符时，DATABASE_URL 必须做 URL 编码；Compose 示例建议使用随机十六进制密码。

## 自动化验证

```bash
npm run lint
npm run build
npm run test:proxy
npm run build --prefix server
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/city_test npm run test:integration
npx playwright install chromium
npm run test:e2e
```

数据库集成测试必须使用名为 city_test 的专用数据库，详细保护规则见 server/README.md。浏览器 E2E 要求后端在 3102 端口运行、演示数据库已初始化，后端的 CORS_ORIGIN 包含 `http://127.0.0.1:5178`；测试自动启动 5178 端口的 Vite。默认 E2E 管理员密码为 `LocalDemo-Admin-2026`，也可用 SEED_ADMIN_PASSWORD 覆盖。E2E 创建的资源在测试结束时清理。

CI 配置覆盖数据库集成、类型构建、前端 lint/build、代理测试和浏览器业务流程。工作流文件存在不代表远程 CI 已执行，本地执行证据另见验收记录。

## 五分钟演示

1. 用 admin 登录，展示城市概览，解释聚合查询与演示数据来源。
2. 新建一个仪表盘，用城市数据源选择 cities 表、name/population 字段，生成并保存图表。
3. 刷新页面，证明数据来自数据库；复制仪表盘，查看复制后的图表，讲清事务边界。
4. 切换 analyst/visitor，演示服务端拒绝越权写入及私人资源访问，而不仅是隐藏按钮。
5. 发送一轮 AI 数据分析，刷新恢复历史，解释会话归属、整轮持久化及无模型密钥时的降级。

面试可展开：为什么只允许白名单查询、为什么前端 RBAC 不足、复制事务如何回滚、Token 如何避免沿用旧角色、流式展示与消息持久化如何一致。不能将演示种子数据、单进程限流和本地分析分别包装成实时数据平台、分布式限流和 RAG 系统。

## 部署

后端独立运行并迁移数据库，前端构建产物可由静态服务托管并反代 `/api`。Pages 部署需配置 API_ORIGIN 为已部署后端的 HTTPS 源站，不能填带路径或账号密码的 URL。API 密钥和数据库配置只存在服务端。此次改造不会向现有线上实例自动发布。
