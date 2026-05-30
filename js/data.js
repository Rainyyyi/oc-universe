/**
 * 🌌 OC宇宙 - 数据管理模块
 * 
 * 双模式支持：
 *   - 已登录：透传到 window.API（Appwrite 云端）
 *   - 未登录 / 离线：LocalStorage 本地模式
 * 
 * 页面代码调用 window.OCData.xxx() 即可，无需感知底层存储。
 */

// ==================== 存储键 ====================
const STORAGE_KEYS = {
  WORLDS: 'oc_worlds',
  CHARACTERS: 'oc_characters',
  STORIES: 'oc_stories',
  DIARIES: 'oc_diaries',
  RELATIONS: 'oc_relations',
  CHATS: 'oc_chats',
  SETTINGS: 'oc_settings',
  INSPIRATIONS: 'oc_inspirations'
};

// ==================== 工具函数 ====================
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== 通用CRUD操作 ====================
function getItems(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`读取 ${key} 失败:`, error);
    return [];
  }
}

function saveItems(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (error) {
    console.error(`保存 ${key} 失败:`, error);
    return false;
  }
}

function getItemById(key, id) {
  const items = getItems(key);
  return items.find(item => item.id === id);
}

function addItem(key, item) {
  const items = getItems(key);
  item.id = item.id || generateId();
  item.createdAt = new Date().toISOString();
  item.updatedAt = new Date().toISOString();
  items.push(item);
  return saveItems(key, items) ? item : null;
}

function updateItem(key, id, updates) {
  const items = getItems(key);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  return saveItems(key, items) ? items[index] : null;
}

function deleteItem(key, id) {
  const items = getItems(key);
  const filtered = items.filter(item => item.id !== id);
  return saveItems(key, filtered);
}

// ==================== 世界观管理 ====================
function getWorlds() {
  return getItems(STORAGE_KEYS.WORLDS);
}

function getWorld(id) {
  return getItemById(STORAGE_KEYS.WORLDS, id);
}

function createWorld(data) {
  return addItem(STORAGE_KEYS.WORLDS, {
    ...data,
    characterCount: 0,
    storyCount: 0,
    collaborators: data.collaborators || [],
  });
}

function updateWorld(id, data) {
  return updateItem(STORAGE_KEYS.WORLDS, id, data);
}

function deleteWorld(id) {
  // 同时删除关联的角色和故事
  const characters = getCharacters().filter(c => c.worldId !== id);
  const stories = getStories().filter(s => s.worldId !== id);
  saveItems(STORAGE_KEYS.CHARACTERS, characters);
  saveItems(STORAGE_KEYS.STORIES, stories);
  return deleteItem(STORAGE_KEYS.WORLDS, id);
}

// ==================== 角色管理 ====================
function getCharacters() {
  return getItems(STORAGE_KEYS.CHARACTERS);
}

function getCharacter(id) {
  return getItemById(STORAGE_KEYS.CHARACTERS, id);
}

function getCharactersByWorld(worldId) {
  return getCharacters().filter(c => c.worldId === worldId);
}

function createCharacter(data) {
  const character = addItem(STORAGE_KEYS.CHARACTERS, {
    ...data,
    // skills 合并到 attributes 中（与 Appwrite 云端保持一致）
    attributes: {
      ...(data.attributes || {}),
      skills: data.skills || [],
    },
    tags: data.tags || [],
    images: data.images || [],
    quotes: data.quotes || [],
    diaryCount: 0,
    relationCount: 0
  });
  
  // 更新世界观的角色计数
  if (character && data.worldId) {
    const world = getWorld(data.worldId);
    if (world) {
      updateWorld(data.worldId, { characterCount: world.characterCount + 1 });
    }
  }
  
  return character;
}

function updateCharacter(id, data) {
  return updateItem(STORAGE_KEYS.CHARACTERS, id, data);
}

function deleteCharacter(id) {
  const character = getCharacter(id);
  
  // 删除关联的关系
  const relations = getRelations().filter(r => r.sourceId !== id && r.targetId !== id);
  saveItems(STORAGE_KEYS.RELATIONS, relations);
  
  // 更新世界观的角色计数
  if (character && character.worldId) {
    const world = getWorld(character.worldId);
    if (world) {
      updateWorld(character.worldId, { characterCount: Math.max(0, world.characterCount - 1) });
    }
  }
  
  return deleteItem(STORAGE_KEYS.CHARACTERS, id);
}

// ==================== 故事管理 ====================
function getStories() {
  return getItems(STORAGE_KEYS.STORIES);
}

function getStory(id) {
  return getItemById(STORAGE_KEYS.STORIES, id);
}

function getStoriesByWorld(worldId) {
  return getStories().filter(s => s.worldId === worldId);
}

function createStory(data) {
  return addItem(STORAGE_KEYS.STORIES, {
    ...data,
    chapters: data.chapters || [],
    characters: data.characters || [],
    locations: data.locations || [],
    wordCount: 0,
    status: 'draft',
    progress: 0
  });
}

function updateStory(id, data) {
  return updateItem(STORAGE_KEYS.STORIES, id, data);
}

function deleteStory(id) {
  return deleteItem(STORAGE_KEYS.STORIES, id);
}

// ==================== 日记管理 ====================
function getDiaries() {
  return getItems(STORAGE_KEYS.DIARIES);
}

function getDiariesByCharacter(characterId) {
  return getDiaries().filter(d => d.characterId === characterId);
}

function createDiary(data) {
  return addItem(STORAGE_KEYS.DIARIES, {
    ...data,
    forAI: data.forAI !== false // 默认用于AI学习
  });
}

// ==================== 关系管理 ====================
function getRelations() {
  return getItems(STORAGE_KEYS.RELATIONS);
}

function getRelationsByCharacter(characterId) {
  return getRelations().filter(r => 
    r.sourceId === characterId || r.targetId === characterId
  );
}

function createRelation(data) {
  return addItem(STORAGE_KEYS.RELATIONS, {
    ...data,
    strength: data.strength || 50
  });
}

function updateRelation(id, data) {
  return updateItem(STORAGE_KEYS.RELATIONS, id, data);
}

function deleteRelation(id) {
  return deleteItem(STORAGE_KEYS.RELATIONS, id);
}

// ==================== 聊天记录管理 ====================
function getChats() {
  return getItems(STORAGE_KEYS.CHATS);
}

function getChatsByCharacter(characterId) {
  return getChats().filter(c => c.characterId === characterId);
}

function saveChat(data) {
  return addItem(STORAGE_KEYS.CHATS, data);
}

// ==================== 灵感碎片管理 ====================
function getInspirations() {
  return getItems(STORAGE_KEYS.INSPIRATIONS);
}

function createInspiration(data) {
  return addItem(STORAGE_KEYS.INSPIRATIONS, {
    ...data,
    used: false
  });
}

// ==================== 统计数据 ====================
function getStats() {
  const worlds = getWorlds();
  const characters = getCharacters();
  const stories = getStories();
  const chats = getChats();
  
  let totalWords = 0;
  stories.forEach(story => {
    totalWords += story.wordCount || 0;
  });
  
  return {
    worlds: worlds.length,
    characters: characters.length,
    stories: stories.length,
    chats: chats.length,
    totalWords,
    writingStories: stories.filter(s => s.status === 'writing').length,
    completedStories: stories.filter(s => s.status === 'completed').length
  };
}

// ==================== 初始化模拟数据 ====================
// 注意：所有示例数据已清空，用户需要自行创建
function initMockData() {
  // 不再自动创建任何模拟数据
  console.log('🌌 OC宇宙 - 数据已清空，请自行创建');
}

// ==================== 清空所有数据 ====================
function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('🌌 所有数据已清空');
}

// ==================== 管理员登录系统 ====================
const ADMIN_KEY = 'oc_admin';

// 默认管理员账号（可以后续在界面中修改）
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123'
};

// 初始化管理员账号
function initAdmin() {
  if (!localStorage.getItem(ADMIN_KEY)) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(DEFAULT_ADMIN));
  }
}

// 获取管理员信息
function getAdmin() {
  try {
    const admin = localStorage.getItem(ADMIN_KEY);
    return admin ? JSON.parse(admin) : DEFAULT_ADMIN;
  } catch {
    return DEFAULT_ADMIN;
  }
}

// 更新管理员账号
function updateAdmin(username, password) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ username, password }));
  return true;
}

// 验证登录
function verifyLogin(username, password) {
  const admin = getAdmin();
  return admin.username === username && admin.password === password;
}

// 检查是否已登录
function isLoggedIn() {
  return sessionStorage.getItem('oc_logged_in') === 'true';
}

// 登录
function login(username, password) {
  if (verifyLogin(username, password)) {
    sessionStorage.setItem('oc_logged_in', 'true');
    return true;
  }
  return false;
}

// 登出
function logout() {
  sessionStorage.removeItem('oc_logged_in');
}

// 页面加载时初始化管理员
initAdmin();

// ==================== 模式检测 + 统一代理层 ====================
/**
 * 检查是否应该使用 Appwrite 云端模式。
 * 条件：window.API 存在（appwrite.js + api-client.js 均已加载）且用户已登录。
 */
let _useCloud = false;

/**
 * 判断一个错误是否是"云端不可用"（应降级到本地模式）
 * 包括：401 未授权、403 无权限、400 配置错误、网络错误
 */
function isCloudUnavailableError(err) {
  if (!err) return true;
  const status = err.code || err.status || err.response?.status || 0;
  const msg = (err.message || err.type || '').toLowerCase();
  return (
    status === 401 || status === 403 || status === 0 ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('not authorized') ||
    msg.includes('no permissions') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('name_not_resolved') ||
    msg.includes('net::err_') ||
    msg.includes('fulltext index') ||
    msg.includes('prohibited')
  );
}

async function initDataMode() {
  // 占位符配置直接禁用云端，不发任何请求
  const cfg = window.APPWRITE_CONFIG;
  const isPlaceholder = !cfg || !cfg.projectId ||
    cfg.projectId === 'YOUR_PROJECT_ID' ||
    cfg.projectId === '' ||
    cfg.databaseId === 'YOUR_DATABASE_ID' ||
    cfg.databaseId === '' ||
    cfg.bucketId === 'YOUR_BUCKET_ID' ||
    cfg.bucketId === '';
  if (isPlaceholder) {
    _useCloud = false;
    console.log('🌌 数据模式：💾 LocalStorage 本地（Appwrite 未配置）');
    return;
  }
  if (window.AppwriteAuth) {
    // 5 秒超时保护，防止 Appwrite SDK 卡死
    const user = await Promise.race([
      window.AppwriteAuth.getCurrentUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('initDataMode 超时')), 5000))
    ]).catch(() => null);
    _useCloud = !!user;
  }
  console.log(`🌌 数据模式：${_useCloud ? '☁️ Appwrite 云端' : '💾 LocalStorage 本地'}`);
}

function useCloud() {
  // 未配置 Appwrite 占位符时强制走本地模式
  const cfg = window.APPWRITE_CONFIG;
  const isPlaceholder = !cfg || !cfg.projectId ||
    cfg.projectId === 'YOUR_PROJECT_ID' ||
    cfg.databaseId === 'YOUR_DATABASE_ID';
  return !isPlaceholder && _useCloud && window.API;
}

// ==================== 统一 OCData 代理 ====================
/**
 * 云端调用包装器：自动降级到本地模式。
 * 当云端返回 401/403/400/网络错误时，静默切换到本地存储，保证页面可用。
 */
async function withCloudFallback(cloudFn, localFn, ...args) {
  if (!useCloud()) return localFn(...args);
  try {
    return await cloudFn(...args);
  } catch (err) {
    const msg = (err.message || err.type || '').toLowerCase();
    if (msg.includes('avatarurl') && msg.includes('longer than')) {
      // 旧数据 avatarUrl 超长（base64），需手动清理
      console.error('❌ 数据库中存在 base64 头像数据导致查询失败。请去 Appwrite 控制台 → Database → Characters → 将 avatarUrl 过长的记录清空或删除。');
      throw new Error('数据库中旧角色头像数据过长，请清理后刷新页面。详见控制台提示。');
    }
    if (isCloudUnavailableError(err)) {
      // 云端不可用，标记为本地模式（后续调用不再尝试云端）
      if (_useCloud) {
        _useCloud = false;
        console.warn('⚠️ 云端不可用，已自动切换到本地模式：', err.message || err);
      }
      // 尝试用本地方法
      try { return localFn(...args); } catch (localErr) { throw localErr; }
    }
    // 其他错误（如校验失败）直接抛出
    throw err;
  }
}

const OCDataProxy = {
  // 世界观
  async getWorlds() {
    return withCloudFallback(() => window.API.worlds.getAll(), getWorlds);
  },
  async getWorld(id) {
    return withCloudFallback(() => window.API.worlds.get(id), () => getWorld(id));
  },
  async createWorld(data) {
    return withCloudFallback(() => window.API.worlds.create(data), () => createWorld(data));
  },
  async updateWorld(id, data) {
    return withCloudFallback(() => window.API.worlds.update(id, data), () => updateWorld(id, data));
  },
  async deleteWorld(id) {
    return withCloudFallback(() => window.API.worlds.delete(id), () => deleteWorld(id));
  },

  // 协作功能
  async shareWorld(worldId, userId) {
    const result = await withCloudFallback(
      () => window.API.worlds.share(worldId, userId),
      () => undefined
    );
    if (result !== undefined) return result;
    const world = getWorld(worldId);
    if (!world) throw new Error('世界观不存在');
    const collabs = world.collaborators || [];
    if (collabs.includes(userId)) return world;
    collabs.push(userId);
    return updateWorld(worldId, { collaborators: collabs });
  },
  async unshareWorld(worldId, userId) {
    const result = await withCloudFallback(
      () => window.API.worlds.unshare(worldId, userId),
      () => undefined
    );
    if (result !== undefined) return result;
    const world = getWorld(worldId);
    if (!world) throw new Error('世界观不存在');
    const collabs = (world.collaborators || []).filter(id => id !== userId);
    return updateWorld(worldId, { collaborators: collabs });
  },

  // 角色
  async getCharacters(worldId) {
    return withCloudFallback(
      () => window.API.characters.getAll(worldId),
      () => worldId ? getCharactersByWorld(worldId) : getCharacters()
    );
  },
  async getCharacter(id) {
    return withCloudFallback(() => window.API.characters.get(id), () => getCharacter(id));
  },
  async getCharactersByWorld(worldId) {
    return withCloudFallback(() => window.API.characters.getAll(worldId), () => getCharactersByWorld(worldId));
  },
  /**
   * 获取指定世界的所有角色（含协作者创建的，用于统计数量）
   */
  async getCharactersForWorld(worldId) {
    return withCloudFallback(
      () => window.API.characters.getForWorld(worldId),
      () => getCharactersByWorld(worldId) // 本地降级：用带 userId 过滤的版本
    );
  },
  async createCharacter(data) {
    return withCloudFallback(() => window.API.characters.create(data), () => createCharacter(data));
  },
  async updateCharacter(id, data) {
    return withCloudFallback(() => window.API.characters.update(id, data), () => updateCharacter(id, data));
  },
  async deleteCharacter(id) {
    return withCloudFallback(() => window.API.characters.delete(id), () => deleteCharacter(id));
  },

  // 故事
  async getStories(worldId) {
    return withCloudFallback(
      () => window.API.stories.getAll(worldId),
      () => worldId ? getStoriesByWorld(worldId) : getStories()
    );
  },
  async getStory(id) {
    return withCloudFallback(() => window.API.stories.get(id), () => getStory(id));
  },
  async getStoriesByWorld(worldId) {
    return withCloudFallback(() => window.API.stories.getAll(worldId), () => getStoriesByWorld(worldId));
  },
  /**
   * 获取指定世界的所有故事（含协作者创建的，用于统计数量）
   */
  async getStoriesForWorld(worldId) {
    return withCloudFallback(
      () => window.API.stories.getForWorld(worldId),
      () => getStoriesByWorld(worldId) // 本地降级
    );
  },
  async createStory(data) {
    return withCloudFallback(() => window.API.stories.create(data), () => createStory(data));
  },
  async updateStory(id, data) {
    return withCloudFallback(() => window.API.stories.update(id, data), () => updateStory(id, data));
  },
  async deleteStory(id) {
    return withCloudFallback(() => window.API.stories.delete(id), () => deleteStory(id));
  },

  // 日记
  async getDiaries(characterId) {
    return withCloudFallback(
      () => window.API.diaries.getAll(characterId),
      () => characterId ? getDiariesByCharacter(characterId) : getDiaries()
    );
  },
  async getDiariesByCharacter(characterId) {
    return withCloudFallback(
      () => window.API.diaries.getAll(characterId),
      () => getDiariesByCharacter(characterId)
    );
  },
  async createDiary(data) {
    return withCloudFallback(() => window.API.diaries.create(data), () => createDiary(data));
  },

  // 关系
  async getRelations(worldId) {
    return withCloudFallback(
      () => window.API.relations.getAll(worldId),
      () => worldId ? getRelations().filter(r => r.worldId === worldId) : getRelations()
    );
  },
  async getRelationsByCharacter(characterId) {
    return withCloudFallback(async () => {
      const all = await window.API.relations.getAll();
      return all.filter(r => r.sourceId === characterId || r.targetId === characterId);
    }, () => getRelationsByCharacter(characterId));
  },
  async createRelation(data) {
    return withCloudFallback(() => window.API.relations.create(data), () => createRelation(data));
  },
  async updateRelation(id, data) {
    return withCloudFallback(() => window.AppwriteDB?.relations.update(id, data), () => updateRelation(id, data));
  },
  async deleteRelation(id) {
    return withCloudFallback(() => window.AppwriteDB?.relations.delete(id), () => deleteRelation(id));
  },

  // 聊天
  async getChats(characterId, limit) {
    return withCloudFallback(
      () => window.API.chats.getAll(characterId, limit),
      () => characterId ? getChatsByCharacter(characterId) : getChats()
    );
  },
  async getChatsByCharacter(characterId) {
    return withCloudFallback(() => window.API.chats.getAll(characterId), () => getChatsByCharacter(characterId));
  },
  async saveChat(data) {
    return withCloudFallback(() => window.API.chats.save(data), () => saveChat(data));
  },

  // 灵感
  async getInspirations(worldId) {
    return withCloudFallback(
      () => window.API.inspirations.getAll(worldId),
      () => worldId ? getInspirations().filter(i => i.worldId === worldId) : getInspirations()
    );
  },
  async createInspiration(data) {
    return withCloudFallback(() => window.API.inspirations.create(data), () => createInspiration(data));
  },

  // 统计（本地计算，始终同步）
  getStats,

  // LocalStorage 操作（保留）
  initMockData,
  clearAllData,

  // 认证（代理到 AppwriteAuth，兼容原本地登录）
  async login(username, password) {
    const cfg = window.APPWRITE_CONFIG;
    const isPlaceholder = !cfg || !cfg.projectId || cfg.projectId === 'YOUR_PROJECT_ID' ||
      cfg.projectId === '' || cfg.databaseId === 'YOUR_DATABASE_ID' || cfg.databaseId === '' ||
      cfg.bucketId === 'YOUR_BUCKET_ID' || cfg.bucketId === '';
    if (isPlaceholder) return false;
    if (window.AppwriteAuth) {
      try {
        await window.AppwriteAuth.login(username, password);
        _useCloud = true;
        return true;
      } catch (e) {
        console.error('Appwrite 登录失败:', e);
        throw e;
      }
    }
    return login(username, password);
  },
  async logout() {
    const cfg = window.APPWRITE_CONFIG;
    const isPlaceholder = !cfg || !cfg.projectId || cfg.projectId === 'YOUR_PROJECT_ID' ||
      cfg.projectId === '' || cfg.databaseId === 'YOUR_DATABASE_ID' || cfg.databaseId === '' ||
      cfg.bucketId === 'YOUR_BUCKET_ID' || cfg.bucketId === '';
    if (!isPlaceholder && window.AppwriteAuth) {
      await window.AppwriteAuth.logout().catch(() => {});
      _useCloud = false;
    }
    logout();
  },
  async isLoggedIn() {
    const cfg = window.APPWRITE_CONFIG;
    const isPlaceholder = !cfg || !cfg.projectId || cfg.projectId === 'YOUR_PROJECT_ID' ||
      cfg.projectId === '' || cfg.databaseId === 'YOUR_DATABASE_ID' || cfg.databaseId === '' ||
      cfg.bucketId === 'YOUR_BUCKET_ID' || cfg.bucketId === '';
    if (isPlaceholder) return false;
    if (window.AppwriteAuth) return window.AppwriteAuth.isAuthenticated();
    return isLoggedIn();
  },
  getAdmin,
  updateAdmin,
  verifyLogin,

  // 初始化数据模式（页面加载时调用）
  initDataMode,
};

// 导出函数供其他模块使用
window.OCData = OCDataProxy;
