# Datapilot API

城市视图的自有后端。默认监听 `127.0.0.1:3102`，所有业务路由保留 `/api` 前缀。服务端使用 Fastify、Node.js、TypeScript 和 PostgreSQL，不能连接任意远程 SQL 数据源。

## 环境

通过进程环境注入配置。不要提交 `.env` 或连接凭据。

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | 开发/演示 PostgreSQL 数据库 |
| `TEST_DATABASE_URL` | 测试时 | 专用集成测试数据库，必须指向数据库 `city_test` |
| `JWT_SECRET` | 是 | 至少 32 字符的随机签名密钥 |
| `HOST` | 否 | 默认 `127.0.0.1`；容器中可设为 `0.0.0.0` |
| `PORT` | 否 | 默认 `3102` |
| `DATABASE_SSL` | 否 | `true` 时启用 PostgreSQL SSL |
| `CORS_ORIGIN` | 否 | 逗号分隔来源，默认同时允许 `localhost:5173` 与 `127.0.0.1:5173` |
| `UPLOAD_MAX_BYTES` | 否 | 头像大小上限，默认 2 MiB |
| `AI_API_KEY` | 否 | OpenAI-compatible 提供商密钥 |
| `AI_BASE_URL` | 否 | 默认 `https://api.openai.com/v1` |
| `AI_MODEL` | 否 | 默认 `gpt-4.1-mini` |
| `AI_TIMEOUT_MS` | 否 | 提供商请求超时，默认 30000 |
| `AI_MAX_OUTPUT_TOKENS` | 否 | 提供商输出 token 上限，默认 800 |
| `AI_MAX_OUTPUT_CHARS` | 否 | 服务端接受的最大输出字符数，默认 16000 |
| `SEED_ADMIN_PASSWORD` | seed 时 | `admin` 的显式初始密码 |
| `SEED_ANALYST_PASSWORD` | seed 时 | `analyst` 的显式初始密码 |
| `SEED_USER_PASSWORD` | seed 时 | `visitor` 的显式初始密码 |

seed 账号为 `admin`（`super_admin`）、`analyst`（`analyst`）和 `visitor`（`user`）。三项密码必须由调用者显式注入，缺失时 seed 直接失败。

## 启动

```bash
npm ci
npm run migrate
npm run seed
npm run build
npm start
```

开发模式使用 `npm run dev`。readiness 端点为：

```text
GET /api/health
```

数据库可用时返回 HTTP 200：

```json
{"code":200,"message":"ok","data":{"status":"ok","database":"ok"}}
```

数据库 `SELECT 1` 失败时返回 HTTP 503。

## 已实现契约

所有普通响应使用前端现有的 `{code, message, data}` 包装。受保护接口使用 `Authorization: Bearer <token>`。

- `GET /api/auth/captcha`、`POST /api/auth/login`、`GET /api/auth/me`
- `/api/users` 用户 CRUD、启停、管理员重置密码、头像上传
- `/api/roles` 固定角色的只读列表、名称/描述更新；`/api/permissions` 权限树只读
- `/api/datasources`、表/字段发现、`POST /:id/query`
- `/api/dashboards`、详情、创建、克隆、删除
- `/api/charts`、详情、创建、更新、删除、预览
- `/api/cities` 城市列表、总览、设施、拥堵、热力图、事件、环境
- `GET /api/export/cities`、`GET /api/export/events`
- `/api/ai/conversations` 会话与消息持久化

数据源 MVP 只开放 PostgreSQL `cities` 表。表名和字段都来自白名单，客户端不能提交 SQL、远程 endpoint 或数据源凭据。

### AI 对话

当前前端的 AI 请求契约为：

```http
POST /api/ai/chat
Content-Type: application/json
Authorization: Bearer <token>

{"conversationId": 123, "content": "上海当前空气质量如何？"}
```

服务端先验证会话归属，再生成完整答案，随后在一个 PostgreSQL 事务中同时插入 user 与 assistant 消息。事务提交后才返回 SSE：

```text
data: {"type":"text","content":"..."}

data: [DONE]
```

没有 `AI_API_KEY` 时，服务端查询真实城市数据并返回 `type: "fallback"`，内容明确标注“确定性数据分析降级”；不会伪造模型调用。配置提供商后，密钥只存在服务端，请求使用非流式生成，避免出现“已回复但消息未提交”的半轮状态。

调用生成器前记录会话 `updated_at`，提交时在同一事务内做乐观并发比较。相同会话的并发请求若上下文已经变化，返回 HTTP 409，避免消息按错误历史顺序落库。提供商调用统一受超时、`max_tokens` 和最大字符数限制。

`POST /api/ai/conversations/:id/messages` 仅为旧前端保留，已废弃且只接受 `role: "user"`；不能通过该接口伪造 assistant 持久化。

## 权限与安全

- `admin`/`super_admin` 可以管理用户、角色和全部业务对象。
- `analyst` 可以维护本人仪表盘和图表，并可查看公开仪表盘。
- `user` 只能查看公开仪表盘、城市数据和本人的 AI 会话。
- RBAC 固定为 `super_admin`、`admin`、`analyst`、`user`。新增/删除角色及动态修改角色权限会明确返回 409；权限树仅用于展示，不会出现保存成功但授权无效的状态。
- 非固定角色用户不能登录或继续调用受保护 API。
- 每次受保护请求都重新读取用户与角色状态，停用账号不会因旧 JWT 继续生效。
- 密码使用带随机 salt 的 `scrypt`；验证码一次性消费并在 5 分钟后过期。
- 数据查询只接受固定表/字段枚举，不接受原始 SQL。
- 仪表盘克隆和 AI 双消息写入均由真实 PostgreSQL 事务保证。

## 集成测试

测试需要一个专用的 `city_test` 数据库。测试会创建随机 schema，执行迁移、seed，启动真实 HTTP 服务，结束后删除 schema。

```bash
TEST_DATABASE_URL='postgresql://.../city_test' npm run test:integration
```

测试不会读取或修改 `.env`。若 URL 不是 `city_test`，测试会在开始前拒绝运行。覆盖范围：

- health、验证码、登录、Token 与验证码复用拒绝
- JWT 篡改、过期、缺少时间字段和非法 subject 拒绝
- 服务端固定 RBAC、动态授权明确拒绝、用户写入和跨用户对象隔离
- 数据源白名单查询及注入式表名拒绝
- 仪表盘/图表创建、预览、克隆
- 数据库触发器强制克隆失败后的整体回滚
- 城市聚合、AI 会话归属、SSE 降级
- assistant 插入失败时 user+assistant 整轮回滚
- 同会话并发生成的上下文版本冲突与 409
- 伪造 `X-Forwarded-For` 时登录限流仍生效
- 未受信 Origin 返回受控 403，已配置开发 Origin 可正常跨域请求

也可以使用 Node 测试的过滤参数单独定位用例。

## Docker

Dockerfile 暴露 `3102`，构建产物为 `dist/index.js`、`dist/migrate.js`。容器外部的编排应先运行迁移和 seed，再启动 API；用户面不应接触数据库连接串或 AI 密钥。
