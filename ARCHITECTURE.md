# OC宇宙 - 项目架构文档

## 一、项目概述

OC宇宙是一个原创角色（Original Character）全生命周期管理平台，提供世界观可视化、角色管理、故事创作、AI 聊天、关系图谱等功能。


## 二、技术栈

### 2.1 前端技术

| 类别 | 技术 |
|------|------|
| 页面结构 | HTML5 |
| 样式 | CSS3（CSS Variables 主题系统） |
| 脚本 | JavaScript ES6+（原生，无框架） |
| 可视化 | Canvas API（宇宙星图）、ECharts（关系图谱） |
| 图标 | Lucide Icons（CDN 引入） |
| 字体 | Google Fonts（Noto Sans SC + Quicksand） |

### 2.2 后端 & 云服务（全部 Appwrite）

| 类别 | 技术 | 用途 |
|------|------|------|
| 前端部署 | Vercel | 静态网站托管 |
| 数据库 | Appwrite Database | NoSQL 文档数据库 |
| 认证 | Appwrite Auth | 邮箱/密码登录注册 |
| 文件存储 | Appwrite Storage | 角色头像、世界观封面 |
| 函数（预留） | Appwrite Functions | AI 大模型代理（待配置） |

### 2.3 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│   ┌──────────────┐    ┌──────────────┐                     │
│   │  Vercel 静态  │    │ Appwrite SDK │                     │
│   │  HTML/CSS/JS │    │ （浏览器直连）│                     │
│   └──────────────┘    └──────┬───────┘                     │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTPS
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │  Database │       │   Auth    │       │  Storage  │
   │  9 集合   │       │  邮箱密码  │       │  文件存储  │
   └───────────┘       └───────────┘       └───────────┘
         │                                           │
         └──────────── Appwrite Cloud ───────────────┘
```

> 前端直连 Appwrite，无中间 Node.js 后端服务。已登录用户数据走云端，未登录用户数据走浏览器 LocalStorage。

## 三、项目结构

```
oc-universe/
├── index.html                  # 首页 - 宇宙星图 + 世界观管理
├── pages/                      # 功能页面
│   ├── characters.html         # 角色管理（CRUD、分类筛选、批量导入）
│   ├── stories.html            # 故事管理（CRUD、状态追踪、关联角色）
│   ├── story-editor.html       # 专业写作编辑器（三栏布局、章节管理）
│   ├── chat.html               # AI 聊天（角色对话）
│   ├── relationship-map.html   # 关系图谱（ECharts 力导向图）
│   └── admin.html              # 管理后台（统计、备份、成员管理）
├── css/                        # 样式
│   ├── style.css               # 全局样式 + CSS 变量（浅蓝紫银河主题）
│   ├── layout.css              # 组件布局（导航栏、侧边栏、卡片、弹窗）
│   ├── dark-mode.css           # 毛玻璃浅色模式（全站统一）
│   ├── cosmos.css              # 宇宙星图样式（星空背景、行星、轨道）
│   └── writer.css              # 写作编辑器样式（三栏布局、工具栏）
├── js/                         # 核心逻辑
│   ├── app.js                  # 主应用（主题管理、导航、全局初始化）
│   ├── appwrite.js             # ⭐ Appwrite 核心（Auth/DB/Storage/Profiles）
│   ├── api-client.js           # API 客户端（对接 AppwriteDB，兼容 window.API）
│   ├── data.js                 # 数据层（双模式：Appwrite 云端 / LocalStorage）
│   ├── cosmos.js               # 宇宙星图引擎（Canvas 渲染 + UI 控制）
│   ├── writer.js               # 写作编辑器核心（章节管理、排版、自动保存）
│   ├── chat-ai.js              # AI 聊天规则引擎
│   └── chat-llm.js             # 大模型聊天模块（待接入 Appwrite Functions）
├── vercel.json                 # Vercel 部署配置
├── server-local.js             # 本地开发服务器
├── favicon.svg                 # 网站图标
├── README.md                   # 项目说明
├── ARCHITECTURE.md             # 本文档（系统架构）
├── REQUIREMENTS.md             # 需求规格说明
├── APPWRITE_SETUP.md           # Appwrite 配置指南
└── DEPLOYMENT.md               # 部署指南
```

## 四、核心模块说明

### 4.1 Appwrite 核心层 (`js/appwrite.js`)

**职责**：初始化 Appwrite SDK，封装所有后端服务。

**导出对象**：

| 对象 | 说明 |
|------|------|
| `window.AppwriteAuth` | 用户认证（注册/登录/登出/改昵称/改密码） |
| `window.AppwriteDB` | 数据库 CRUD（worlds/characters/stories/diaries/relations/chats/inspirations/settings） |
| `window.AppwriteStorage` | 文件存储（上传/预览/删除） |
| `window.AppwriteProfiles` | 用户昵称缓存（sync 同步 + batchLookup 批量查询） |
| `window.APPWRITE_CONFIG` | Appwrite 项目配置 |
| `window.COLLECTIONS` | 集合名常量映射 |

### 4.2 API 客户端层 (`js/api-client.js`)

**职责**：将 AppwriteDB 封装为 `window.API`，保证接口格式与历史版本兼容。

- 文档字段自动转换：`$id` → `id`、`$createdAt` → `createdAt`
- AI 聊天：降级为提示信息，待 Appwrite Functions 配置后替换

### 4.3 数据层 (`js/data.js`)

**职责**：统一数据出口 `window.OCData`。

**双模式自动切换**：
- 已登录 → 透传到 `window.API`（Appwrite 云端）
- 未登录 → 直接读写 LocalStorage（离线也能用）
- 云端异常 → 自动降级本地模式

**主要方法**：
- 世界观: `getWorlds`, `getWorld`, `createWorld`, `updateWorld`, `deleteWorld`
- 协作: `shareWorld`, `unshareWorld`
- 角色: `getCharacters`, `getCharacter`, `createCharacter`, `updateCharacter`, `deleteCharacter`
- 故事: `getStories`, `getStory`, `createStory`, `updateStory`, `deleteStory`
- 关系: `getRelations`, `createRelation`, `updateRelation`, `deleteRelation`
- 聊天: `getChats`, `saveChat`
- 统计: `getStats`

### 4.4 宇宙星图引擎 (`js/cosmos.js`)

**职责**：首页世界观可视化——Canvas 星空背景 + 行星 + OC 轨道粒子。

**核心类**：
- `CosmosEngine`：Canvas 渲染引擎（StarField / WorldPlanet / OrbitingStar 三层）
- `CosmosUI`：星图/网格视图切换、布局计算、悬浮详情卡

**交互**：
- 视口：拖拽平移 + 滚轮缩放（min 0.4x / max 2.5x）
- 星球：单独拖拽移动位置 + 悬停轨道高亮
- 视图：星图 ↔ 网格一键切换

**轨道系统**：5 条轨道，半径 [82, 112, 148, 190, 238]，各容纳 [3, 4, 5, 7, 11] 个角色。

### 4.5 写作编辑器 (`js/writer.js`)

**职责**：独立写作页面核心逻辑。

**功能**：
- 分卷 + 章节两级树形管理（新增/重命名/删除/切换）
- 富文本编辑（标题/粗体/斜体/对齐/列表/引用/分隔线/撤销重做）
- 排版控制（首行缩进 + 行距）
- 3 秒防抖自动保存
- 进度统计（字数/进度环/章节排行）
- 聚焦模式（F11 切换）

### 4.6 AI 聊天模块 (`js/chat-ai.js` + `js/chat-llm.js`)

- **chat-ai.js**：基于规则模板的简单回复（当前可用）
- **chat-llm.js**：大模型聊天引擎（待配置 Appwrite Functions 后启用）

## 五、数据流

### 5.1 云端模式（已登录）

```
用户操作 → 页面事件
              │
              ▼
      OCData.xxx()          ← data.js（_useCloud = true）
              │
              ▼
      window.API.xxx()      ← api-client.js（字段转换）
              │
              ▼
      AppwriteDB.xxx()      ← appwrite.js（SDK 调用）
              │
              ▼
      Appwrite Cloud        ← 数据库 / 认证 / 存储
```

### 5.2 本地模式（未登录 / 云端不可用）

```
用户操作 → 页面事件
              │
              ▼
      OCData.xxx()          ← data.js（_useCloud = false）
              │
              ▼
      localStorage 读写      ← 浏览器本地存储
```

## 六、Appwrite 数据集合

| 集合 ID | 说明 | 关键字段 |
|---------|------|----------|
| worlds | 世界观 | name, type, tone, description, coverImage, userId, collaborators |
| characters | 角色 | worldId, name, avatarUrl, gender, age, tags, description, userId |
| stories | 故事 | worldId, title, summary, status, chapters, characters, wordCount, userId |
| diaries | 日记 | characterId, worldId, title, content, mood, forAI, userId |
| relations | 角色关系 | worldId, sourceId, targetId, relationType, userId |
| chats | AI 聊天记录 | characterId, role, content, userId |
| inspirations | 灵感碎片 | worldId, title, content, type, userId |
| settings | 用户设置 | theme, language, userId |
| profiles | 用户昵称缓存 | name, avatar, userId |


## 七、设计特点

| 特点 | 说明 |
|------|------|
| 无后端架构 | 前端直连 Appwrite，无需维护 Node.js 服务 |
| 离线兜底 | 未登录时自动切换 LocalStorage，核心功能不受影响 |
| 双模式统一接口 | `window.OCData` 统一封装，上层页面无需关心数据来源 |
| 向后兼容 | `window.API` 接口格式保持稳定 |
| 模块化 | 各功能页面独立，JS 模块职责清晰 |
| 文档级权限 | 通过 Appwrite 权限控制协作数据访问 |
| 昵称系统 | Profiles 集合缓存用户昵称，避免暴露原始 ID |
| 统一主题 | 浅蓝紫银河配色 + 毛玻璃风格全站统一 |

---

*文档版本：4.0*  
*更新时间：2026-05-30*  
*变更：反映当前项目实际状态（宇宙星图、写作编辑器、Profiles、Cosmos模块等）*
