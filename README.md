# RelayAPI

AI API 代理服务，支持故障转移（failover）。统一管理多个 AI provider 的 API 密钥，自动处理请求失败时的切换。

## 功能特性

- **用户认证** - 注册、登录、JWT 会话管理
- **Provider 管理** - 添加和管理多个 AI 服务提供商（如 OpenAI、Anthropic 等）
- **Credential 管理** - 安全存储 API 密钥，支持多个密钥轮换
- **模型映射** - 配置模型别名，灵活切换底层模型
- **Failover 机制** - 请求失败时自动切换到备用 provider
- **代理接口** - 兼容 OpenAI API 格式的 `/api/v1/chat/completions` 端点

## 快速开始

### 安装

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

### 数据库迁移

```bash
npm run db:push
```

### 运行

```bash
npm run dev
```

访问 http://localhost:3000

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 数据库连接字符串（Neon 或其他兼容数据库） |
| `JWT_SECRET` | JWT 签名密钥，至少 32 个字符 |

## API 端点

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/me` | 获取当前用户信息 |

### Provider 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers` | 获取所有 providers |
| POST | `/api/providers` | 创建 provider |
| PUT | `/api/providers/[id]` | 更新 provider |
| DELETE | `/api/providers/[id]` | 删除 provider |

### Credential 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/credentials` | 获取所有 credentials |
| POST | `/api/credentials` | 创建 credential |
| PUT | `/api/credentials/[id]` | 更新 credential |
| DELETE | `/api/credentials/[id]` | 删除 credential |

### 模型映射

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mappings` | 获取所有映射 |
| POST | `/api/mappings` | 创建映射 |
| PUT | `/api/mappings/[id]` | 更新映射 |
| DELETE | `/api/mappings/[id]` | 删除映射 |

### 代理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chat/completions` | 聊天补全代理（兼容 OpenAI API 格式） |

## 技术栈

- **框架**: Next.js 16
- **前端**: React 19, Tailwind CSS 4
- **数据库**: Drizzle ORM + Neon PostgreSQL
- **UI 组件**: shadcn/ui
- **认证**: JWT (jose)
