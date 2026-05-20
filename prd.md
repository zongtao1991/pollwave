# PollWave — 实时投票与问卷平台 PRD

## 1. 产品概述

PollWave 是一个实时投票与问卷平台，支持创建多种题型的投票/问卷，参与者通过分享链接作答，结果实时更新并可视化。定位：会议投票、团队决策、活动互动、快速调研。

## 2. 技术栈

- **后端**: Node.js + Express + TypeScript
- **ORM**: TypeORM + SQLite (better-sqlite3)
- **实时**: Socket.IO
- **前端**: 原生 HTML/CSS/JavaScript + Chart.js
- **认证**: JWT
- **端口**: 7911

## 3. 数据模型

### 3.1 users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| username | VARCHAR(50) UNIQUE | 用户名 |
| email | VARCHAR(100) UNIQUE | 邮箱 |
| password_hash | VARCHAR(255) | 密码哈希 |
| created_at | DATETIME | 注册时间 |

### 3.2 polls
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| creator_id | INTEGER FK → users.id | 创建者 |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述 |
| is_anonymous | BOOLEAN DEFAULT false | 是否匿名投票 |
| allow_multiple | BOOLEAN DEFAULT false | 是否允许多选（针对单选题） |
| status | VARCHAR(10) DEFAULT 'draft' | draft / active / closed |
| share_code | VARCHAR(8) UNIQUE | 分享短码（随机生成） |
| max_responses | INTEGER | 最大响应数限制（null=无限） |
| closed_at | DATETIME | 定时关闭时间（null=手动关闭） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 3.3 questions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| poll_id | INTEGER FK → polls.id | 所属投票 |
| text | VARCHAR(500) | 题目文本 |
| type | VARCHAR(15) | single_choice / multiple_choice / text_input / rating |
| is_required | BOOLEAN DEFAULT true | 是否必答 |
| sort_order | INTEGER | 排序 |
| options | TEXT | 选项 JSON 数组（choice 类型）: `["选项A","选项B"]` |

### 3.4 responses
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| poll_id | INTEGER FK → polls.id | 所属投票 |
| respondent_id | INTEGER FK → users.id | 回答者（匿名时 null） |
| respondent_name | VARCHAR(50) | 非登录用户填写的昵称 |
| submitted_at | DATETIME | 提交时间 |
| ip_address | VARCHAR(45) | 防重复提交用 |

### 3.5 answers
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| response_id | INTEGER FK → responses.id | 所属响应 |
| question_id | INTEGER FK → questions.id | 题目 |
| value | TEXT | 答案值（选项文本、输入文本、评分数字） |

### 3.6 poll_shares
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| poll_id | INTEGER FK → polls.id | 所属投票 |
| share_code | VARCHAR(8) UNIQUE | 唯一分享码 |
| created_by | INTEGER FK → users.id | 创建者 |
| expires_at | DATETIME | 过期时间 |
| created_at | DATETIME | 创建时间 |

## 4. API 设计

### 4.1 认证
- `POST /api/auth/register`
- `POST /api/auth/login`

### 4.2 投票管理（需认证=创建者）
- `GET /api/polls` — 我创建的投票列表
- `POST /api/polls` — 创建投票（含题目和选项）
- `GET /api/polls/:id` — 投票详情（含题目）
- `PUT /api/polls/:id` — 修改投票（仅 draft 状态）
- `DELETE /api/polls/:id` — 删除投票
- `POST /api/polls/:id/activate` — 发布投票（draft → active）
- `POST /api/polls/:id/close` — 关闭投票（active → closed）
- `GET /api/polls/:id/results` — 获取投票结果统计
- `GET /api/polls/:id/responses` — 获取所有响应详情（含每题答案）
- `GET /api/polls/:id/export` — 导出 CSV

### 4.3 分享
- `POST /api/polls/:id/share` — 生成分享链接（返回 share_code）
- `GET /api/share/:code` — 通过分享码获取投票信息（无需认证）

### 4.4 作答（无需认证，通过 share_code 访问）
- `POST /api/share/:code/respond` — 提交回答
  - 匿名投票: 仅需 answers，可选 respondent_name
  - 实名投票: 需 JWT 认证
  - 同一 IP 同一投票只能提交一次（非匿名时按用户去重）

### 4.5 结果 API
- `GET /api/polls/:id/results` — 统计数据:
  - 每题的选项分布（饼图/柱状图数据）
  - 文本题的回答列表
  - 评分题的平均分、分布
  - 总响应数、完成率

## 5. 实时协作 (Socket.IO)

### 5.1 连接
- 客户端连接时通过 `auth.token` 传递 JWT（可选，匿名投票不需要）

### 5.2 投票房间
- 创建者打开投票结果页时发送 `join_poll` 事件（pollId），加入 room
- 有新回答提交时，服务端向 room 内广播 `new_response` 事件（含响应摘要）
- 投票状态变更（关闭/重新开放）时广播 `poll_status_changed`

### 5.3 在线查看
- 创建者可看到当前正在查看投票的人数（`viewer_count`）

## 6. 前端 UI 要求

### 6.1 页面
- **登录/注册页**: 简洁表单
- **我的投票（Dashboard）**: 卡片列表，显示标题、状态徽标、响应数、操作按钮
- **创建投票页**: 标题+描述输入，动态添加/删除/排序题目，每题设置类型和选项
- **投票作答页**（公开，通过 share_code 访问）:
  - 显示投票标题和描述
  - 逐题展示，支持单选按钮、多选复选框、文本输入、星级评分
  - 提交按钮 + 进度条
  - 提交后显示"感谢参与"及结果链接（如果创建者允许）
- **结果页**（创建者可见）:
  - 响应总数卡片
  - 每题一个图表（Chart.js 饼图/柱状图）
  - 文本回答列表
  - 实时更新（Socket.IO 新响应时自动刷新图表）

### 6.2 样式
- 深色主题（背景 #0c0a1d，卡片 #1a1735，强调色 #8b5cf6）
- 状态徽标: draft=灰色、active=绿色、closed=红色
- 选项卡片 hover 效果

## 7. 业务规则

- 投票必须至少有 1 道题目才能发布
- closed 状态的投票不能再接受回答
- 匿名投票不记录 respondent_id，但仍记录 IP（防刷）
- 达到 max_responses 后自动关闭
- 分享码为 8 位字母数字随机串，唯一
- 导出 CSV 包含: 响应时间、回答者（匿名显示"匿名"）、每题答案一列

## 8. 启动方式

```bash
cd pollwave
npm install
npm run dev
```

访问 `http://localhost:7911`

## 9. 测试数据

初始化:
- 2 个用户: admin / admin@test.com / admin123, demo / demo@test.com / demo123
- admin 创建一个活跃投票"2026 团队技术栈偏好调查"（5 道题: 单选+多选+文本+评分）
- demo 创建一个草稿投票"产品需求优先级投票"（3 道题）
- "技术栈偏好" 有 8 条响应（模拟数据）
- 每个投票有分享码和过期时间
