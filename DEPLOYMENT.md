# 🚀 OC宇宙部署指南

本文档指导你将OC宇宙部署到Vercel（前端）、Cyclic（后端API）和Supabase（数据库）。

## 目录
1. [准备工作](#1-准备工作)
2. [Supabase数据库部署](#2-supabase数据库部署)
3. [Cyclic后端部署](#3-cyclic后端部署)
4. [Vercel前端部署](#4-vercel前端部署)
5. [大模型配置](#5-大模型配置)
6. [数据迁移](#6-数据迁移)

---

## 1. 准备工作

### 1.1 注册账号
- [Supabase](https://supabase.com) - 免费数据库+认证+存储
- [Cyclic](https://cyclic.sh) - 免费后端部署
- [Vercel](https://vercel.com) - 免费前端部署
- [OpenAI](https://platform.openai.com) - 大模型API（需要付费）

### 1.2 准备API密钥
获取以下密钥：
- Supabase: `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
- OpenAI: `OPENAI_API_KEY`

---

## 2. Supabase数据库部署

### 2.1 创建项目
1. 登录 [Supabase](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - Name: `oc-universe`
   - Database Password: 设置密码（记住它）
   - Region: 选择亚洲区域（如Singapore）
4. 等待项目创建完成

### 2.2 创建数据表
1. 在Supabase控制台，点击左侧 "SQL Editor"
2. 复制 [`supabase/schema.sql`](supabase/schema.sql) 的内容
3. 粘贴到SQL Editor并点击 "Run"
4. 等待执行完成

### 2.3 获取API密钥
1. 点击左侧 "Project Settings" (齿轮图标)
2. 点击 "API"
3. 复制：
   - `Project URL` → 作为 `SUPABASE_URL`
   - `anon public` 密钥 → 作为 `SUPABASE_ANON_KEY`

---

## 3. Cyclic后端部署

### 3.1 准备代码
```bash
cd oc-universe/server
```

### 3.2 部署到Cyclic
**方式一：GitHub部署（推荐）**
1. 将 `oc-universe` 文件夹推送到GitHub
2. 登录 [Cyclic](https://cyclic.sh)
3. 点击 "Connect Repository"
4. 选择你的GitHub仓库
5. 在环境变量中添加：
   - `SUPABASE_URL`: 你的Supabase URL
   - `SUPABASE_ANON_KEY`: 你的Supabase anon key
   - `OPENAI_API_KEY`: 你的OpenAI API密钥
   - `NODE_ENV`: production
6. 点击 "Deploy"

**方式二：Cyclic CLI**
```bash
npm install -g cyclic
cyclic login
cyclic link
cyclic deploy
```

### 3.3 获取API地址
部署完成后，Cyclic会给你一个URL，例如：
`https://your-app-name.cyclic.app`

---

## 4. Vercel前端部署

### 4.1 修改API配置
在部署前，需要修改 [`js/api-client.js`](js/api-client.js) 中的API地址：

```javascript
const API_CONFIG = {
  baseUrl: 'https://your-cyclic-app.cyclic.app', // 替换为你的Cyclic URL
  // ...
};
```

或者使用环境变量（推荐）：
```javascript
baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
```

### 4.2 部署到Vercel
**方式一：GitHub部署（推荐）**
1. 将代码推送到GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击 "New Project"
4. 导入你的GitHub仓库
5. 配置环境变量：
   - `VITE_API_URL`: 你的Cyclic API地址
6. 点击 "Deploy"

**方式二：Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel
```

---

## 5. 大模型配置

### 5.1 OpenAI API
在Cyclic的环境变量中添加：
- `OPENAI_API_KEY`: 你的OpenAI API密钥
- `OPENAI_MODEL`: gpt-3.5-turbo（默认）

### 5.2 如何让AI学习OC的说话特点
系统会自动从以下数据构建提示词：
1. **角色档案** - 性格特点、背景设定
2. **标签** - 性格标签
3. **语录** - 经典台词
4. **日记** - 标记为"forAI"的日记

**优化建议：**
- 在角色设置中详细填写性格描述
- 多添加角色的经典语录
- 写日记时勾选"供AI学习"选项
- 日记内容越丰富，AI越能模仿角色说话风格

---

## 6. 数据迁移

### 6.1 本地数据迁移
如果你之前的数据保存在LocalStorage中，可以使用迁移功能：

1. 登录部署后的网站
2. 打开浏览器开发者工具（F12）
3. 在控制台执行：
```javascript
// 迁移所有数据
await window.API.migrate();
```

### 6.2 手动迁移
或者手动导出导入JSON数据。

---

## 配置检查清单

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | Supabase项目创建 | ☐ |
| 2 | 数据库表创建 | ☐ |
| 3 | Cyclic后端部署 | ☐ |
| 4 | 环境变量配置 | ☐ |
| 5 | Vercel前端部署 | ☐ |
| 6 | 数据迁移测试 | ☐ |
| 7 | AI聊天测试 | ☐ |

---

## 常见问题

### Q: 聊天提示"未授权"错误
A: 检查Cyclic环境变量中是否正确配置了`SUPABASE_URL`和`SUPABASE_ANON_KEY`

### Q: AI回复很慢或失败
A: 
1. 检查OpenAI API密钥是否有效
2. 检查Cyclic日志是否有错误
3. 确认API配额是否用完

### Q: 部署后数据丢失
A: 需要执行数据迁移，参见第6节

### Q: 如何修改API地址
A: 修改 [`js/api-client.js`](js/api-client.js) 中的 `baseUrl`

---

## 下一步

部署完成后，你可以：
1. 🎉 邀请朋友一起使用
2. 🤖 优化角色的AI提示词
3. 📱 添加更多OC角色
4. 📝 继续完善世界观

祝你玩得开心！🌌
