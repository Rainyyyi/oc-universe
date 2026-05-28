/**
 * OC宇宙 - API客户端（Appwrite 版本）
 * 
 * 保持 window.API 接口与原版一致，页面代码无需改动。
 * 底层已切换为 AppwriteDB（定义在 appwrite.js）。
 * 
 * AI 聊天（sendAI）暂时降级为规则引擎，等后续接 Appwrite Functions。
 */

// ==================== 文档格式转换 ====================
// Appwrite 文档用 $id / $createdAt / $updatedAt，原代码用 id / createdAt / updatedAt
// 统一转换，让页面代码无感知

function normalize(doc) {
  if (!doc) return null;
  const result = {
    ...doc,
    id: doc.$id || doc.id,
    createdAt: doc.$createdAt || doc.createdAt,
    updatedAt: doc.$updatedAt || doc.updatedAt,
  };
  // 解析 JSON 字符串字段
  if (typeof result.attributes === 'string') {
    try { result.attributes = JSON.parse(result.attributes); } catch(e) { result.attributes = {}; }
  }
  // 从 attributes 中提取 skills（合并存储）
  if (result.attributes && Array.isArray(result.attributes.skills)) {
    result.skills = result.attributes.skills;
  } else if (!result.skills) {
    result.skills = [];
  }
  // 确保 collaborators 是数组（Appwrite 中以逗号分隔的 String 存储）
  if (!result.collaborators) {
    result.collaborators = [];
  } else if (typeof result.collaborators === 'string') {
    result.collaborators = result.collaborators.split(',').filter(id => id.trim()).map(id => id.trim());
  } else if (!Array.isArray(result.collaborators)) {
    result.collaborators = [];
  }
  return result;
}

function normalizeList(docs) {
  return (docs || []).map(normalize);
}

// ==================== 世界观 ====================

async function getWorlds() {
  const docs = await window.AppwriteDB.worlds.list();
  return normalizeList(docs);
}

async function getWorld(id) {
  const doc = await window.AppwriteDB.worlds.get(id);
  return normalize(doc);
}

async function createWorld(data) {
  const doc = await window.AppwriteDB.worlds.create(data);
  return normalize(doc);
}

async function updateWorld(id, data) {
  const doc = await window.AppwriteDB.worlds.update(id, data);
  return normalize(doc);
}

async function deleteWorld(id) {
  await window.AppwriteDB.worlds.delete(id);
  return { success: true };
}

async function shareWorld(worldId, userId) {
  const doc = await window.AppwriteDB.worlds.get(worldId);
  // collaborators 可能是字符串（Appwrite 存储）或数组
  let collabs;
  if (typeof doc.collaborators === 'string') {
    collabs = doc.collaborators.split(',').filter(id => id.trim()).map(id => id.trim());
  } else if (Array.isArray(doc.collaborators)) {
    collabs = [...doc.collaborators];
  } else {
    collabs = [];
  }
  if (!collabs.includes(userId)) {
    collabs.push(userId);
    const updated = await window.AppwriteDB.worlds.update(worldId, { collaborators: collabs });
    return normalize(updated);
  }
  return normalize(doc);
}

async function unshareWorld(worldId, userId) {
  const doc = await window.AppwriteDB.worlds.get(worldId);
  let collabs;
  if (typeof doc.collaborators === 'string') {
    collabs = doc.collaborators.split(',').filter(id => id.trim()).map(id => id.trim());
  } else {
    collabs = Array.isArray(doc.collaborators) ? doc.collaborators : [];
  }
  collabs = collabs.filter(id => id !== userId);
  const updated = await window.AppwriteDB.worlds.update(worldId, { collaborators: collabs });
  return normalize(updated);
}

// ==================== 角色 ====================

async function getCharacters(worldId = null) {
  const docs = worldId
    ? await window.AppwriteDB.characters.listByWorld(worldId)
    : await window.AppwriteDB.characters.list();
  return normalizeList(docs);
}

async function getCharacter(id) {
  const doc = await window.AppwriteDB.characters.get(id);
  return normalize(doc);
}

async function createCharacter(data) {
  const doc = await window.AppwriteDB.characters.create(data);
  return normalize(doc);
}

async function updateCharacter(id, data) {
  const doc = await window.AppwriteDB.characters.update(id, data);
  return normalize(doc);
}

async function deleteCharacter(id) {
  await window.AppwriteDB.characters.delete(id);
  return { success: true };
}

// ==================== 故事 ====================

async function getStories(worldId = null) {
  const docs = worldId
    ? await window.AppwriteDB.stories.listByWorld(worldId)
    : await window.AppwriteDB.stories.list();
  return normalizeList(docs);
}

async function getStory(id) {
  const doc = await window.AppwriteDB.stories.get(id);
  return normalize(doc);
}

async function createStory(data) {
  const doc = await window.AppwriteDB.stories.create(data);
  return normalize(doc);
}

async function updateStory(id, data) {
  const doc = await window.AppwriteDB.stories.update(id, data);
  return normalize(doc);
}

async function deleteStory(id) {
  await window.AppwriteDB.stories.delete(id);
  return { success: true };
}

// ==================== 日记 ====================

async function getDiaries(characterId = null) {
  const docs = characterId
    ? await window.AppwriteDB.diaries.listByCharacter(characterId)
    : await window.AppwriteDB.diaries.list();
  return normalizeList(docs);
}

async function createDiary(data) {
  const doc = await window.AppwriteDB.diaries.create(data);
  return normalize(doc);
}

// ==================== 关系 ====================

async function getRelations(worldId = null) {
  const docs = worldId
    ? await window.AppwriteDB.relations.listByWorld(worldId)
    : await window.AppwriteDB.relations.list();
  return normalizeList(docs);
}

async function createRelation(data) {
  const doc = await window.AppwriteDB.relations.create(data);
  return normalize(doc);
}

// ==================== 聊天记录 ====================

async function getChats(characterId = null, limit = 100) {
  if (!characterId) return [];
  const docs = await window.AppwriteDB.chats.listByCharacter(characterId, limit);
  return normalizeList(docs);
}

async function saveChat(data) {
  const doc = await window.AppwriteDB.chats.save(data);
  return normalize(doc);
}

// ==================== AI 聊天（暂时规则引擎降级）====================
// TODO: 后续接 Appwrite Functions 做 OpenAI 代理

async function sendAIMessage(characterId, worldId, message) {
  // 获取角色信息，用规则引擎回复
  try {
    const character = await getCharacter(characterId);
    const name = character?.name || '角色';
    // 降级：返回提示信息
    return {
      response: `✨ ${name} 的 AI 对话功能正在开发中，敬请期待～`,
      character: { id: characterId, name }
    };
  } catch {
    return {
      response: '✨ AI 对话功能正在开发中，敬请期待～',
      character: { id: characterId, name: '角色' }
    };
  }
}

// ==================== 设置 ====================

async function getSettings() {
  const doc = await window.AppwriteDB.settings.get();
  return doc ? normalize(doc) : { theme: 'light', language: 'zh-CN' };
}

async function updateSettings(data) {
  const doc = await window.AppwriteDB.settings.save(data);
  return normalize(doc);
}

// ==================== 灵感碎片 ====================

async function getInspirations(worldId = null) {
  const docs = worldId
    ? await window.AppwriteDB.inspirations.listByWorld(worldId)
    : await window.AppwriteDB.inspirations.list();
  return normalizeList(docs);
}

async function createInspiration(data) {
  const doc = await window.AppwriteDB.inspirations.create(data);
  return normalize(doc);
}

// ==================== 文件上传（替代 base64 存 LocalStorage）====================

async function uploadFile(file) {
  const fileId = await window.AppwriteStorage.upload(file);
  const url = window.AppwriteStorage.previewUrl(fileId);
  return { fileId, url };
}

// ==================== 导出（兼容原 window.API 接口）====================
window.API = {
  worlds: {
    getAll: getWorlds,
    get: getWorld,
    create: createWorld,
    update: updateWorld,
    delete: deleteWorld,
    share: shareWorld,
    unshare: unshareWorld,
  },
  characters: {
    getAll: getCharacters,
    get: getCharacter,
    create: createCharacter,
    update: updateCharacter,
    delete: deleteCharacter,
  },
  stories: {
    getAll: getStories,
    get: getStory,
    create: createStory,
    update: updateStory,
    delete: deleteStory,
  },
  diaries: {
    getAll: getDiaries,
    create: createDiary,
  },
  relations: {
    getAll: getRelations,
    create: createRelation,
  },
  chats: {
    getAll: getChats,
    save: saveChat,
    sendAI: sendAIMessage,
  },
  settings: {
    get: getSettings,
    update: updateSettings,
  },
  inspirations: {
    getAll: getInspirations,
    create: createInspiration,
  },
  storage: {
    upload: uploadFile,
    previewUrl: window.AppwriteStorage?.previewUrl,
    delete: window.AppwriteStorage?.delete,
  },
};
