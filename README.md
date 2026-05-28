# OC宇宙 - 角色与世界观管理系统

一个面向创作者的角色与故事管理平台，支持世界观、角色、故事、关系图谱等模块的全栈管理。

## 项目结构

```
oc-universe/
├── pages/                      # 页面模块
│   ├── admin.html              # 管理后台（数据统计、备份管理）
│   ├── characters.html         # 角色管理（CRUD、分类筛选）
│   ├── stories.html            # 故事管理（状态追踪、编辑入口）
│   ├── relationship-map.html   # 关系图谱（角色关系可视化）
│   └── story-editor.html       # 故事编辑器（富文本编写）
├── css/                        # 样式文件
│   ├── style.css               # 全局样式、主题变量、CSS变量
│   ├── layout.css              # 组件样式（卡片、按钮、弹窗、表单）
│   └── dark-mode.css           # 暗色模式覆盖
├── js/                         # JavaScript 模块
│   ├── app.js                  # 主应用逻辑（主题、通知、数据初始化）
│   ├── api-client.js           # API 客户端（Appwrite + 本地存储降级）
│   ├── data-store.js           # 本地存储封装（localStorage）
│   └── components.js           # 通用组件（弹窗、卡片渲染）
├── index.html                  # 首页（世界观列表、创建入口）
├── server-local.js             # 本地开发服务器（Node.js）
├── vercel.json                 # Vercel 部署配置
├── APPWRITE_SETUP.md           # Appwrite 后端配置文档
├── ARCHITECTURE.md             # 系统架构文档
├── DEPLOYMENT.md               # 部署指南
└── README.md
```

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| HTML5 + CSS3 + JavaScript | 页面结构与样式 |
| CSS Variables | 主题切换（亮色/暗色） |
| Lucide Icons | 线性图标库 |
| Google Fonts (Noto Sans SC) | 中文字体 |
| localStorage | 本地数据持久化 |
| Appwrite (BaaS) | 云端数据库、存储、认证 |

### 后端服务

| 服务 | 用途 |
|------|------|
| Appwrite | 后端即服务（数据库、存储、函数） |
| Appwrite Functions | 支付回调、AI 对话等云函数 |

### 部署

| 平台 | 用途 |
|------|------|
| Appwrite Hosting | 前端静态网站托管 |
| Appwrite Cloud | 后端服务（数据库、存储、函数） |

## 功能模块

| 模块 | 页面 | 功能说明 |
|------|------|---------|
| 首页 | `index.html` | 世界观列表、创建/编辑/删除、数据导入导出 |
| 角色 | `pages/characters.html` | 角色 CRUD、分类筛选、头像管理 |
| 故事 | `pages/stories.html` | 故事 CRUD、状态追踪（草稿/进行中/已完成） |
| 关系图谱 | `pages/relationship-map.html` | 角色关系可视化 |
| 故事编辑 | `pages/story-editor.html` | 富文本编辑器、Markdown 支持 |
| 管理后台 | `pages/admin.html` | 数据统计、备份管理（需登录） |

## 数据模型

### 世界观 (World)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| name | string | 名称 |
| type | string | 类型（奇幻/科幻/现代/古风/其他） |
| tone | string | 基调（黑暗/温馨/中性/明暗交织） |
| description | string | 简介 |
| coverImage | string | 封面图 URL |
| characterCount | number | 角色数量 |
| storyCount | number | 故事数量 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

### 角色 (Character)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| worldId | string | 所属世界观 ID |
| name | string | 名称 |
| avatar | string | 头像 URL |
| category | string | 分类 |
| description | string | 简介 |
| attributes | object | 属性（年龄、性别、职业等） |
| createdAt | timestamp | 创建时间 |

### 故事 (Story)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| worldId | string | 所属世界观 ID |
| title | string | 标题 |
| content | string | 正文 |
| status | string | 状态（草稿/进行中/已完成） |
| tags | array | 标签 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

## 扩展指南

### 添加新页面

1. 在 `pages/` 下创建新 HTML 文件
2. 引入公共 CSS 和 JS：
   ```html
   <link rel="stylesheet" href="../css/style.css">
   <link rel="stylesheet" href="../css/layout.css">
   <link rel="stylesheet" href="../css/dark-mode.css">
   <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
   ```
3. 在侧边栏添加导航入口

### 添加新功能模块

1. 在 `js/` 下创建功能模块文件
2. 在 `data-store.js` 中添加数据操作方法
3. 在 `components.js` 中添加 UI 组件

### 主题定制

修改 `css/style.css` 中的 CSS 变量即可调整主题色：

```css
:root {
  --primary-color: #2563EB;
  --primary-light: #60A5FA;
  --accent-color: #38BDF8;
}
```

## 开发规范

- 使用 ES6+ 语法
- 图标统一使用 [Lucide Icons](https://lucide.dev/)
- CSS 变量定义在 `style.css` 的 `:root` 中
- 移动端优先响应式设计

## 浏览器支持

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |

## License

MIT
