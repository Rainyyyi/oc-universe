# 🌌 OC宇宙 - 项目架构文档

## 一、项目概述

OC宇宙是一个原创角色（Original Character）全生命周期管理平台，提供世界观构建、角色管理、故事创作、智能聊天、可视化关系图谱等功能。

## 二、技术栈

### 2.1 前端技术
| 类别 | 技术 |
|------|------|
| 前端框架 | 原生 HTML5 + CSS3 + JavaScript (ES6+) |
| 可视化 | ECharts |
| 图标 | Font Awesome 6.4.0 |
| 编辑器 | 原生 Markdown |

### 2.2 后端 & 云服务（全部 Appwrite）
| 类别 | 技术 | 用途 |
|------|------|------|
| 前端部署 | Vercel | 静态网站托管 |
| 数据库 | Appwrite Database | NoSQL 文档数据库 |
| 认证 | Appwrite Auth | 邮箱/密码、OAuth 登录 |
| 文件存储 | Appwrite Storage | 角色头像、世界封面 |
| 函数（待配置） | Appwrite Functions | AI 聊天 OpenAI 代理 |

### 2.3 部署架构
```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                                 ▼
   ┌───────────┐                   ┌───────────────┐
   │  Vercel   │◄──────────────────│ Appwrite Cloud│
   │ (静态前端) │   Appwrite SDK    │  Database     │
   └───────────┘   (浏览器直连)    │  Auth         │
                                   │  Storage      │
                                   │  Functions    │
                                   └───────────────┘
```

> 注意：不再需要 Node.js 后端服务（原 Cyclic），前端通过 Appwrite Web SDK 直连云端。

## 三、模块划分

```
oc-universe/
├── index.html              # 首页 - 世界观列表
├── pages/                  # 功能页面
│   ├── characters.html     # 角色管理
│   ├── stories.html        # 故事管理
│   ├── story-editor.html   # 故事编辑器
│   ├── chat.html           # AI聊天
│   ├── relationship-map.html # 关系图谱
│   └── admin.html          # 管理后台
├── css/                    # 样式
│   ├── style.css           # 全局样式
│   ├── layout.css          # 布局
│   └── dark-mode.css       # 暗色模式
├── js/                     # 核心逻辑
│   ├── app.js              # 主应用（主题管理、全局配置）
│   ├── appwrite.js         # ⭐ Appwrite 核心（Auth/DB/Storage 初始化）
│   ├── api-client.js       # API客户端（对接 AppwriteDB，兼容 window.API 接口）
│   ├── data.js             # 数据层（双模式：Appwrite 云端 / LocalStorage 兜底）
│   ├── chat-ai.js          # AI聊天（规则引擎）
│   └── chat-llm.js         # 大模型聊天模块（待接 Appwrite Functions）
├── vercel.json             # Vercel 配置（纯静态）
├── APPWRITE_SETUP.md       # ⭐ Appwrite 配置指南
└── DEPLOYMENT.md           # 部署指南
```

## 四、核心模块说明

### 1. Appwrite 核心层 (appwrite.js)
- **职责**：初始化 Appwrite SDK，封装 Auth / Database / Storage
- **导出**：
  - `window.AppwriteAuth` - 注册、登录、登出、获取当前用户
  - `window.AppwriteDB` - 各集合的 CRUD（worlds/characters/stories/diaries/relations/chats/inspirations/settings）
  - `window.AppwriteStorage` - 文件上传/预览/删除

### 2. API客户端层 (api-client.js)
- **职责**：将 AppwriteDB 封装为 `window.API`，格式与原 Supabase/Cyclic 版本兼容
- **转换**：Appwrite 文档的 `$id` / `$createdAt` 自动转为 `id` / `createdAt`
- **AI聊天**：当前降级为提示信息，等 Appwrite Functions 配置后替换

### 3. 数据层 (data.js)
- **职责**：统一数据出口，`window.OCData`
- **双模式**：
  - 已登录 → 透传到 `window.API`（Appwrite 云端）
  - 未登录 → 直接用 LocalStorage（离线也能使用）

### 4. AI聊天层 (chat-ai.js / chat-llm.js)
- **规则引擎** (chat-ai.js)：基于模板的简单回复（当前可用）
- **大模型引擎** (chat-llm.js)：待配置 Appwrite Functions 后启用

## 五、数据流

### 5.1 已登录用户（Appwrite 云端）
```
用户操作 → 页面事件
                ↓
        OCData.xxx()（data.js）
                ↓ _useCloud = true
        window.API.xxx()（api-client.js）
                ↓
        AppwriteDB.xxx()（appwrite.js）
                ↓
        Appwrite SDK（浏览器直连）
                ↓
        Appwrite Cloud
```

### 5.2 未登录用户（LocalStorage 离线）
```
用户操作 → 页面事件
                ↓
        OCData.xxx()（data.js）
                ↓ _useCloud = false
        LocalStorage CRUD
```

## 六、Appwrite 数据集合

| 集合 ID | 说明 | 关键字段 |
|---------|------|----------|
| worlds | 世界观 | name, type, tone, description, coverImage, userId |
| characters | 角色 | worldId, name, personality, tags, quotes, userId |
| stories | 故事 | worldId, title, content, status, chapters, userId |
| diaries | 日记 | characterId, title, content, forAI, userId |
| relations | 关系 | worldId, sourceId, targetId, relationType, userId |
| chats | 聊天记录 | characterId, role, content, userId |
| inspirations | 灵感碎片 | worldId, title, content, type, userId |
| settings | 用户设置 | theme, language, userId |

详细建库步骤见 **APPWRITE_SETUP.md**。

## 七、设计特点

1. **无后端架构** - 前端直连 Appwrite，无需维护 Node.js 服务
2. **离线兜底** - 未登录时自动切换 LocalStorage，可本地体验
3. **向后兼容** - `window.API` 接口保持不变，页面代码无需修改
4. **模块化** - 各功能模块独立，便于维护
5. **主题支持** - CSS变量实现亮色/暗色模式切换

---

*文档版本：3.0*
*更新时间：2026-05-14*
*变更：Supabase + Cyclic 后端 → Appwrite Cloud（无后端架构）*
