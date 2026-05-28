# 🛠️ Appwrite 配置指南

本文件说明如何在 Appwrite Cloud 上初始化 OC宇宙 所需的所有资源。

---

## 第一步：创建项目

1. 打开 [cloud.appwrite.io](https://cloud.appwrite.io)，登录/注册
2. 点击 **Create Project**，填写项目名称（如 `oc-universe`）
3. 记下 **Project ID**（在项目设置页面可以找到）

---

## 第二步：配置 Web 平台

1. 进入项目 → **Settings** → **Platforms** → **Add Platform** → **Web**
2. **Name**：`OC宇宙前端`
3. **Hostname**：
   - 本地开发：`localhost`
   - 生产环境：你的 Vercel 域名（如 `oc-universe.vercel.app`）
4. 保存

---

## 第三步：启用邮箱密码认证

1. 进入 **Auth** → **Settings**
2. 找到 **Email/Password**，开启开关
3. 保存

---

## 第四步：创建数据库

1. 进入 **Databases** → **Create Database**
2. **Database ID**：`oc-universe`（或自定义，记下来）
3. 记下 **Database ID**

### 创建集合（按下表逐一创建）

进入数据库 → **Create Collection**，ID 和名称保持一致：

#### 1. `worlds`（世界观）

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| userId | String(36) | ✅ | — | 所属用户 |
| name | String(100) | ✅ | — | 世界观名称 |
| description | String(2000) | ❌ | '' | 描述 |
| type | String(20) | ❌ | '' | fantasy/scifi/modern/historical/other |
| tone | String(20) | ❌ | '' | dark/light/neutral/mixed |
| coverImage | String(500) | ❌ | null | 封面图片 URL |
| coverFileId | String(36) | ❌ | null | 封面文件 ID |
| tags | String[] | ❌ | [] | 标签 |
| characterCount | Integer | ❌ | 0 | 角色计数 |
| storyCount | Integer | ❌ | 0 | 故事计数 |

**索引**：在 `userId` 上创建 Key 类型索引

**权限**：Collection Level → 勾选 `Any` 的 Create/Read/Update/Delete（或按需配置 Role-based）

---

#### 2. `characters`（角色）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | 所属用户 |
| worldId | String(36) | ✅ | 所属世界观 |
| name | String(100) | ✅ | 角色名 |
| avatarUrl | String(500) | ❌ | 头像 URL |
| avatarFileId | String(36) | ❌ | 头像文件 ID |
| description | String(2000) | ❌ | 简介 |
| personality | String(1000) | ❌ | 性格描述 |
| background | String(5000) | ❌ | 背景故事 |
| age | String(20) | ❌ | 年龄 |
| gender | String(20) | ❌ | 性别 |
| race | String(50) | ❌ | 种族 |
| tags | String[] | ❌ | 标签 |
| quotes | String[] | ❌ | 语录 |
| attributes | String(5000) | ❌ | JSON 字符串（属性/能力） |
| skills | String(5000) | ❌ | JSON 字符串（技能树） |

**索引**：`userId`、`worldId` 分别建 Key 索引

---

#### 3. `stories`（故事）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| worldId | String(36) | ✅ | |
| title | String(200) | ✅ | |
| summary | String(1000) | ❌ | 故事简介 |
| content | String(100000) | ❌ | 正文 Markdown |
| status | String(20) | ❌ | draft/writing/completed |
| wordCount | Integer | ❌ | 字数 |
| progress | Integer | ❌ | 进度 0-100 |
| characters | String[] | ❌ | 出场角色 ID |
| locations | String[] | ❌ | 地点列表 |
| chapters | String(50000) | ❌ | JSON 字符串（章节数组） |

**索引**：`userId`、`worldId` 建 Key 索引

---

#### 4. `diaries`（日记）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| characterId | String(36) | ✅ | |
| worldId | String(36) | ❌ | |
| title | String(200) | ❌ | |
| content | String(10000) | ✅ | |
| mood | String(50) | ❌ | 心情 |
| forAI | Boolean | ❌ | 是否用于 AI 学习，默认 true |

**索引**：`userId`、`characterId` 建 Key 索引

---

#### 5. `relations`（关系）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| worldId | String(36) | ✅ | |
| sourceId | String(36) | ✅ | 关系源角色 ID |
| targetId | String(36) | ✅ | 关系目标角色 ID |
| relationType | String(100) | ❌ | 关系类型（如：好友、敌人） |
| description | String(500) | ❌ | 关系描述 |
| strength | Integer | ❌ | 关系强度 0-100 |

**索引**：`userId`、`worldId`、`sourceId`、`targetId` 建 Key 索引

---

#### 6. `chats`（聊天记录）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| characterId | String(36) | ✅ | |
| worldId | String(36) | ❌ | |
| role | String(20) | ✅ | user / assistant |
| content | String(5000) | ✅ | 消息内容 |

**索引**：`userId`、`characterId` 建 Key 索引

---

#### 7. `inspirations`（灵感碎片）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| worldId | String(36) | ❌ | |
| title | String(200) | ❌ | |
| content | String(5000) | ✅ | |
| type | String(50) | ❌ | idea/dialogue/scene/other |
| used | Boolean | ❌ | 是否已使用，默认 false |

---

#### 8. `settings`（用户设置）

| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | String(36) | ✅ | |
| theme | String(20) | ❌ | light / dark |
| language | String(10) | ❌ | zh-CN |
| aiConfig | String(2000) | ❌ | JSON 字符串（AI 配置） |

---

## 第五步：创建 Storage Bucket

1. 进入 **Storage** → **Create Bucket**
2. **Bucket ID**：`oc-media`（或自定义，记下来）
3. **Name**：`OC媒体文件`
4. **Permissions**：允许已登录用户 Create/Read/Delete
5. **Allowed file types**：`image/jpeg, image/png, image/webp, image/gif`
6. **Max file size**：5MB

---

## 第六步：填写配置到代码

打开 `js/appwrite.js`，找到顶部 `APPWRITE_CONFIG`，填入你的值：

```javascript
const APPWRITE_CONFIG = {
  endpoint: 'https://cloud.appwrite.io/v1',
  projectId: 'YOUR_PROJECT_ID',    // ← Project ID
  databaseId: 'oc-universe',       // ← Database ID
  bucketId: 'oc-media',            // ← Bucket ID
};
```

---

## 第七步：配置 CORS / 安全域名

如果遇到跨域问题：

1. Appwrite Cloud 会自动信任你在 **Platforms** 里填写的域名
2. 本地开发确保 Hostname 填了 `localhost`（不含端口）

---

## 第八步（可选）：配置 AI 聊天 Functions

AI 聊天功能需要 Appwrite Functions 代理 OpenAI 调用（避免暴露 API Key）：

1. 进入 **Functions** → **Create Function**
2. Runtime：`Node.js 18`
3. 上传函数代码（后续单独配置）
4. 添加环境变量：`OPENAI_API_KEY`
5. 在 `js/appwrite.js` 更新 `CHAT_FUNCTION_ID`

---

## 常见问题

**Q: 创建文档时报 401？**  
A: 检查 Appwrite Platform 有没有添加你当前的域名（localhost 或 Vercel 域名）。

**Q: 查询返回空，但 Dashboard 里有数据？**  
A: 检查集合的权限设置，确保登录用户有 Read 权限，并且数据里的 `userId` 和当前登录用户一致。

**Q: 图片上传失败？**  
A: 检查 Bucket 权限，和文件类型/大小限制。

**Q: 文档字段报 "Unknown attribute"？**  
A: 集合里没创建该属性，去 Attributes 标签页补充。
