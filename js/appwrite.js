/**
 * 🌌 OC宇宙 - Appwrite 核心模块
 * 替代原 Supabase + Cyclic 后端
 * 
 * 使用前请在 Appwrite Cloud 创建项目并配置以下常量：
 *   APPWRITE_ENDPOINT  — 通常是 https://cloud.appwrite.io/v1
 *   APPWRITE_PROJECT   — 你的 Project ID
 *   APPWRITE_DATABASE  — Database ID
 *   APPWRITE_BUCKET    — Storage Bucket ID（存头像/封面）
 * 
 * Collection ID 见下方 COLLECTIONS 常量
 */

// ==================== 配置（修改这里）====================
const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: 'oc-universe',
  databaseId: 'oc-universe',
  bucketId: 'oc-media',
};

// Collection ID 映射（在 Appwrite 控制台创建后填入）
const COLLECTIONS = {
  WORLDS:       'worlds',
  CHARACTERS:   'characters',
  STORIES:      'stories',
  DIARIES:      'diaries',
  RELATIONS:    'relations',
  CHATS:        'chats',
  INSPIRATIONS: 'inspirations',
  SETTINGS:     'settings',
};

// ==================== 占位符检测 ====================
function isPlaceholderConfig() {
  // 直接用本文件内的 APPWRITE_CONFIG 常量，不依赖 window.APPWRITE_CONFIG（避免赋值时序问题）
  const cfg = APPWRITE_CONFIG;
  return !cfg || !cfg.projectId ||
    cfg.projectId === 'YOUR_PROJECT_ID' ||
    cfg.projectId === '' ||
    cfg.databaseId === 'YOUR_DATABASE_ID' ||
    cfg.databaseId === '' ||
    cfg.bucketId === 'YOUR_BUCKET_ID' ||
    cfg.bucketId === '';
}

// ==================== SDK 初始化 ====================
// 通过 CDN 引入的 Appwrite Web SDK（在 HTML 中引入）
// <script src="https://cdn.jsdelivr.net/npm/appwrite@17/dist/iife/sdk.min.js"></script>

let _client = null;
let _account = null;
let _databases = null;
let _storage = null;
let _currentUser = null;

// 初始化时就检测占位符，未配置则禁用云端
if (isPlaceholderConfig()) {
  console.warn('🌌 Appwrite 未配置（projectId/databaseId/bucketId 为占位符），强制使用本地模式');
}

function getClient() {
  if (!_client) {
    if (typeof Appwrite === 'undefined') {
      throw new Error('Appwrite SDK 未加载，请在 HTML 中引入 CDN');
    }
    _client = new Appwrite.Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
  }
  return _client;
}

function getAccount() {
  if (!_account) {
    _account = new Appwrite.Account(getClient());
  }
  return _account;
}

function getDatabases() {
  if (!_databases) {
    _databases = new Appwrite.Databases(getClient());
  }
  return _databases;
}

function getStorage() {
  if (!_storage) {
    _storage = new Appwrite.Storage(getClient());
  }
  return _storage;
}

// ==================== 认证模块 ====================

/**
 * 注册新用户（邮箱 + 密码）
 */
async function authRegister(email, password, name) {
  const account = getAccount();
  const user = await account.create(
    Appwrite.ID.unique(),
    email,
    password,
    name
  );
  // 注册后自动登录
  await authLogin(email, password);
  return user;
}

/**
 * 邮箱密码登录
 */
async function authLogin(email, password) {
  const account = getAccount();
  const session = await account.createEmailPasswordSession(email, password);
  _currentUser = await account.get();
  return session;
}

/**
 * 登出
 */
async function authLogout() {
  const account = getAccount();
  await account.deleteSession('current');
  _currentUser = null;
}

/**
 * 获取当前登录用户，未登录返回 null（带 5 秒超时）
 */
async function getCurrentUser() {
  if (isPlaceholderConfig()) return null; // 占位符配置直接返回 null
  if (_currentUser) return _currentUser;
  try {
    _currentUser = await Promise.race([
      getAccount().get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getCurrentUser 超时')), 5000))
    ]);
    return _currentUser;
  } catch {
    return null;
  }
}

/**
 * 检查是否已登录
 */
async function isAuthenticated() {
  const user = await getCurrentUser();
  return user !== null;
}

// ==================== 数据库工具函数 ====================

const DB_ID = () => APPWRITE_CONFIG.databaseId;

/**
 * 统一查询（自动加 userId 过滤，带 8 秒超时）
 */
async function dbList(collectionId, extraQueries = []) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  const user = await getCurrentUser();
  if (!user) throw new Error('未登录');

  const queries = [
    Appwrite.Query.equal('userId', user.$id),
    Appwrite.Query.orderDesc('$createdAt'),
    Appwrite.Query.limit(500),
    ...extraQueries,
  ];

  const res = await Promise.race([
    getDatabases().listDocuments(DB_ID(), collectionId, queries),
    new Promise((_, reject) => setTimeout(() => reject(new Error('dbList 超时')), 8000))
  ]);
  return res.documents;
}

/**
 * 获取单条记录（带 5 秒超时）
 */
async function dbGet(collectionId, documentId) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  return Promise.race([
    getDatabases().getDocument(DB_ID(), collectionId, documentId),
    new Promise((_, reject) => setTimeout(() => reject(new Error('dbGet 超时')), 5000))
  ]);
}

/**
 * 创建记录（自动注入 userId，带 8 秒超时）
 */
async function dbCreate(collectionId, data) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  const user = await getCurrentUser();
  if (!user) throw new Error('未登录');

  return Promise.race([
    getDatabases().createDocument(
      DB_ID(),
      collectionId,
      Appwrite.ID.unique(),
      { ...data, userId: user.$id }
    ),
    new Promise((_, reject) => setTimeout(() => reject(new Error('dbCreate 超时')), 8000))
  ]);
}

/**
 * 更新记录（带 5 秒超时）
 */
async function dbUpdate(collectionId, documentId, data) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  // 不允许修改 userId
  const { userId, ...safeData } = data;
  // collaborators 如果是数组则转为字符串（Appwrite 存储格式）
  if (Array.isArray(safeData.collaborators)) {
    safeData.collaborators = collabsToString(safeData.collaborators);
  }
  return Promise.race([
    getDatabases().updateDocument(DB_ID(), collectionId, documentId, safeData),
    new Promise((_, reject) => setTimeout(() => reject(new Error('dbUpdate 超时')), 5000))
  ]);
}

/**
 * 删除记录（带 5 秒超时）
 */
async function dbDelete(collectionId, documentId) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  return Promise.race([
    getDatabases().deleteDocument(DB_ID(), collectionId, documentId),
    new Promise((_, reject) => setTimeout(() => reject(new Error('dbDelete 超时')), 5000))
  ]);
}

// ==================== 文件存储模块 ====================

/**
 * 上传文件（File 对象），返回文件 ID（带 15 秒超时）
 */
async function storageUpload(file) {
  if (isPlaceholderConfig()) throw new Error('Appwrite 未配置');
  const res = await Promise.race([
    getStorage().createFile(
      APPWRITE_CONFIG.bucketId,
      Appwrite.ID.unique(),
      file
    ),
    new Promise((_, reject) => setTimeout(() => reject(new Error('文件上传超时')), 15000))
  ]);
  return res.$id;
}

/**
 * 获取文件预览 URL
 */
function storagePreviewUrl(fileId, width = 400) {
  if (!fileId) return null;
  return getStorage().getFilePreview(
    APPWRITE_CONFIG.bucketId,
    fileId,
    width
  ).href;
}

/**
 * 删除文件
 */
async function storageDelete(fileId) {
  if (!fileId) return;
  return getStorage().deleteFile(APPWRITE_CONFIG.bucketId, fileId);
}

// ==================== 世界观 CRUD ====================

// ==================== 协作工具 ====================
/**
 * collaborators 在 Appwrite 中以逗号分隔的 String 存储（Appwrite 不支持 Array 索引）
 * 代码层面统一用数组操作，读写时自动转换
 */
function collabsToString(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.join(',');
}
function stringToCollabs(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').filter(id => id.trim()).map(id => id.trim());
}

/**
 * 协作查询：我的世界 + 分享给我的世界
 * 合并两个查询结果并去重
 */
async function dbListWithCollabs(collectionId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('未登录');

  // 1. 查我自己创建的
  const myDocs = await dbList(collectionId);

  // 2. 查分享给我的（collaborators 字符串包含我的 ID）
  let sharedDocs = [];
  try {
    sharedDocs = await Promise.race([
      getDatabases().listDocuments(DB_ID(), collectionId, [
        Appwrite.Query.search('collaborators', user.$id),
        Appwrite.Query.orderDesc('$createdAt'),
        Appwrite.Query.limit(500),
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('协作查询超时')), 8000))
    ]);
    sharedDocs = sharedDocs.documents || [];
  } catch (e) {
    console.warn('协作查询失败，仅显示自己的数据:', e.message);
  }

  // 合并去重
  const ids = new Set(myDocs.map(d => d.$id));
  return [...myDocs, ...sharedDocs.filter(d => !ids.has(d.$id))];
}

const AppwriteWorlds = {
  async list() {
    return dbListWithCollabs(COLLECTIONS.WORLDS);
  },
  async get(id) {
    return dbGet(COLLECTIONS.WORLDS, id);
  },
  async create(data) {
    return dbCreate(COLLECTIONS.WORLDS, {
      name: data.name,
      description: data.description || '',
      type: data.type || '',
      tone: data.tone || '',
      coverImage: data.coverImage || null,
      coverFileId: data.coverFileId || null,
      tags: data.tags || [],
      characterCount: 0,
      storyCount: 0,
      collaborators: collabsToString(data.collaborators),
    });
  },
  async update(id, data) {
    return dbUpdate(COLLECTIONS.WORLDS, id, data);
  },
  async delete(id) {
    // 删除关联的角色和故事
    const characters = await AppwriteCharacters.listByWorld(id);
    for (const c of characters) {
      await AppwriteCharacters.delete(c.$id);
    }
    const stories = await AppwriteStories.listByWorld(id);
    for (const s of stories) {
      await AppwriteStories.delete(s.$id);
    }
    return dbDelete(COLLECTIONS.WORLDS, id);
  },
};

// ==================== 角色 CRUD ====================

const AppwriteCharacters = {
  async list() {
    return dbList(COLLECTIONS.CHARACTERS);
  },
  async listByWorld(worldId) {
    return dbList(COLLECTIONS.CHARACTERS, [
      Appwrite.Query.equal('worldId', worldId),
    ]);
  },
  async get(id) {
    return dbGet(COLLECTIONS.CHARACTERS, id);
  },
  async create(data) {
    return dbCreate(COLLECTIONS.CHARACTERS, {
      worldId: data.worldId,
      name: data.name,
      avatarUrl: data.avatarUrl || null,
      avatarFileId: data.avatarFileId || null,
      description: data.description || '',
      personality: data.personality || '',
      background: data.background || '',
      age: data.age || '',
      gender: data.gender || '',
      race: data.race || '',
      tags: data.tags || [],
      quotes: data.quotes || [],
      // skills 合并到 attributes JSON 中（Appwrite 字段数限制 14 个）
      attributes: JSON.stringify({
        ...(data.attributes || {}),
        skills: data.skills || [],
      }),
    });
  },
  async update(id, data) {
    const payload = { ...data };
    // skills 合并到 attributes JSON 中
    const hasAttrs = payload.attributes && typeof payload.attributes === 'object';
    const hasSkills = Array.isArray(payload.skills);
    if (hasAttrs || hasSkills) {
      const baseAttrs = hasAttrs ? payload.attributes : {};
      delete payload.attributes;
      delete payload.skills;
      payload.attributes = JSON.stringify({ ...baseAttrs, skills: hasSkills ? data.skills : (baseAttrs.skills || []) });
    } else if (payload.attributes && typeof payload.attributes === 'string') {
      // 字符串形式的 attributes 保持原样
    }
    return dbUpdate(COLLECTIONS.CHARACTERS, id, payload);
  },
  async delete(id) {
    // 删除关联关系
    const rels = await AppwriteRelations.listByCharacter(id);
    for (const r of rels) {
      await AppwriteRelations.delete(r.$id);
    }
    return dbDelete(COLLECTIONS.CHARACTERS, id);
  },
};

// ==================== 故事 CRUD ====================

const AppwriteStories = {
  async list() {
    return dbList(COLLECTIONS.STORIES);
  },
  async listByWorld(worldId) {
    return dbList(COLLECTIONS.STORIES, [
      Appwrite.Query.equal('worldId', worldId),
    ]);
  },
  async get(id) {
    return dbGet(COLLECTIONS.STORIES, id);
  },
  async create(data) {
    return dbCreate(COLLECTIONS.STORIES, {
      worldId: data.worldId,
      title: data.title,
      summary: data.summary || '',
      content: data.content || '',
      status: data.status || 'draft',
      wordCount: data.wordCount || 0,
      progress: data.progress || 0,
      characters: data.characters || [],
      locations: data.locations || [],
      chapters: data.chapters ? JSON.stringify(data.chapters) : '[]',
    });
  },
  async update(id, data) {
    const payload = { ...data };
    if (payload.chapters && Array.isArray(payload.chapters)) {
      payload.chapters = JSON.stringify(payload.chapters);
    }
    return dbUpdate(COLLECTIONS.STORIES, id, payload);
  },
  async delete(id) {
    return dbDelete(COLLECTIONS.STORIES, id);
  },
};

// ==================== 日记 CRUD ====================

const AppwriteDiaries = {
  async list() {
    return dbList(COLLECTIONS.DIARIES);
  },
  async listByCharacter(characterId) {
    return dbList(COLLECTIONS.DIARIES, [
      Appwrite.Query.equal('characterId', characterId),
    ]);
  },
  async create(data) {
    return dbCreate(COLLECTIONS.DIARIES, {
      characterId: data.characterId,
      worldId: data.worldId || '',
      title: data.title || '',
      content: data.content || '',
      mood: data.mood || '',
      forAI: data.forAI !== false,
    });
  },
  async update(id, data) {
    return dbUpdate(COLLECTIONS.DIARIES, id, data);
  },
  async delete(id) {
    return dbDelete(COLLECTIONS.DIARIES, id);
  },
};

// ==================== 关系 CRUD ====================

const AppwriteRelations = {
  async list() {
    return dbList(COLLECTIONS.RELATIONS);
  },
  async listByWorld(worldId) {
    return dbList(COLLECTIONS.RELATIONS, [
      Appwrite.Query.equal('worldId', worldId),
    ]);
  },
  async listByCharacter(characterId) {
    // 查 sourceId 或 targetId（Appwrite 不支持 OR，分两次查）
    const [asSrc, asTgt] = await Promise.all([
      dbList(COLLECTIONS.RELATIONS, [Appwrite.Query.equal('sourceId', characterId)]),
      dbList(COLLECTIONS.RELATIONS, [Appwrite.Query.equal('targetId', characterId)]),
    ]);
    const seen = new Set();
    return [...asSrc, ...asTgt].filter(r => {
      if (seen.has(r.$id)) return false;
      seen.add(r.$id);
      return true;
    });
  },
  async create(data) {
    return dbCreate(COLLECTIONS.RELATIONS, {
      worldId: data.worldId,
      sourceId: data.sourceId,
      targetId: data.targetId,
      relationType: data.relationType || '',
      description: data.description || '',
      strength: data.strength || 50,
    });
  },
  async update(id, data) {
    return dbUpdate(COLLECTIONS.RELATIONS, id, data);
  },
  async delete(id) {
    return dbDelete(COLLECTIONS.RELATIONS, id);
  },
};

// ==================== 聊天记录 CRUD ====================

const AppwriteChats = {
  async listByCharacter(characterId, limit = 100) {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');
    const res = await getDatabases().listDocuments(DB_ID(), COLLECTIONS.CHATS, [
      Appwrite.Query.equal('userId', user.$id),
      Appwrite.Query.equal('characterId', characterId),
      Appwrite.Query.orderAsc('$createdAt'),
      Appwrite.Query.limit(limit),
    ]);
    return res.documents;
  },
  async save(data) {
    return dbCreate(COLLECTIONS.CHATS, {
      characterId: data.characterId,
      worldId: data.worldId || '',
      role: data.role,
      content: data.content,
    });
  },
  async deleteByCharacter(characterId) {
    const chats = await AppwriteChats.listByCharacter(characterId, 500);
    for (const c of chats) {
      await dbDelete(COLLECTIONS.CHATS, c.$id);
    }
  },
};

// ==================== 灵感碎片 CRUD ====================

const AppwriteInspirations = {
  async list() {
    return dbList(COLLECTIONS.INSPIRATIONS);
  },
  async listByWorld(worldId) {
    return dbList(COLLECTIONS.INSPIRATIONS, [
      Appwrite.Query.equal('worldId', worldId),
    ]);
  },
  async create(data) {
    return dbCreate(COLLECTIONS.INSPIRATIONS, {
      worldId: data.worldId || '',
      title: data.title || '',
      content: data.content || '',
      type: data.type || 'idea',
      used: false,
    });
  },
  async update(id, data) {
    return dbUpdate(COLLECTIONS.INSPIRATIONS, id, data);
  },
  async delete(id) {
    return dbDelete(COLLECTIONS.INSPIRATIONS, id);
  },
};

// ==================== 设置 CRUD ====================

const AppwriteSettings = {
  async get() {
    try {
      const docs = await dbList(COLLECTIONS.SETTINGS);
      return docs[0] || null;
    } catch {
      return null;
    }
  },
  async save(data) {
    const existing = await AppwriteSettings.get();
    if (existing) {
      return dbUpdate(COLLECTIONS.SETTINGS, existing.$id, data);
    } else {
      return dbCreate(COLLECTIONS.SETTINGS, data);
    }
  },
};

// ==================== 全局导出 ====================
window.AppwriteAuth = {
  register: authRegister,
  login: authLogin,
  logout: authLogout,
  getCurrentUser,
  isAuthenticated,
};

window.AppwriteDB = {
  worlds: AppwriteWorlds,
  characters: AppwriteCharacters,
  stories: AppwriteStories,
  diaries: AppwriteDiaries,
  relations: AppwriteRelations,
  chats: AppwriteChats,
  inspirations: AppwriteInspirations,
  settings: AppwriteSettings,
};

window.AppwriteStorage = {
  upload: storageUpload,
  previewUrl: storagePreviewUrl,
  delete: storageDelete,
};

window.APPWRITE_CONFIG = APPWRITE_CONFIG;
window.COLLECTIONS = COLLECTIONS;
