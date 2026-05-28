/**
 * 🌌 OC宇宙 - AI聊天模块
 * 基于规则的简单AI回复生成系统
 */

// ==================== AI配置 ====================
const AI_CONFIG = {
  // 回复延迟范围（毫秒）
  minDelay: 1000,
  maxDelay: 3000,
  // 是否启用性格一致性检查
  personalityCheck: true,
  // 记忆引用概率
  memoryReferenceRate: 0.3
};

// ==================== 角色记忆提取 ====================
class CharacterMemory {
  constructor(characterId) {
    this.characterId = characterId;
    this.character = null;
    this.memories = [];
    this.quotes = [];
    this.diaries = [];
    this.relations = [];
    
    this.load();
  }
  
  load() {
    // 加载角色数据
    const characters = JSON.parse(localStorage.getItem('oc_characters') || '[]');
    this.character = characters.find(c => c.id === this.characterId);
    
    if (!this.character) {
      console.warn('角色未找到:', this.characterId);
      return;
    }
    
    // 提取记忆
    this.extractMemories();
  }
  
  extractMemories() {
    // 从角色档案提取
    if (this.character.description) {
      this.memories.push({
        type: 'profile',
        content: this.character.description,
        weight: 1.0
      });
    }
    
    // 从性格标签提取
    if (this.character.tags && this.character.tags.length > 0) {
      this.memories.push({
        type: 'personality',
        content: `性格特点：${this.character.tags.join('、')}`,
        weight: 0.8
      });
    }
    
    // 从语录提取
    if (this.character.quotes && this.character.quotes.length > 0) {
      this.quotes = this.character.quotes;
    }
    
    // 从日记提取
    const diaries = JSON.parse(localStorage.getItem('oc_diaries') || '[]');
    this.diaries = diaries.filter(d => d.characterId === this.characterId && d.forAI);
    
    // 从关系提取
    const relations = JSON.parse(localStorage.getItem('oc_relations') || '[]');
    this.relations = relations.filter(r => 
      r.sourceId === this.characterId || r.targetId === this.characterId
    );
  }
  
  // 获取相关记忆
  getRelevantMemories(topic) {
    const relevant = [];
    
    this.memories.forEach(memory => {
      if (this.isRelevant(memory.content, topic)) {
        relevant.push(memory);
      }
    });
    
    // 检查日记
    this.diaries.forEach(diary => {
      if (this.isRelevant(diary.content, topic)) {
        relevant.push({
          type: 'diary',
          content: diary.content,
          weight: 0.7
        });
      }
    });
    
    return relevant;
  }
  
  // 简单的相关性检查
  isRelevant(content, topic) {
    if (!content || !topic) return false;
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    // 检查关键词
    const keywords = topicLower.split(/\s+/);
    return keywords.some(keyword => contentLower.includes(keyword));
  }
  
  // 获取关系信息
  getRelationInfo(otherCharacterName) {
    // 这里需要根据角色名查找关系
    return this.relations.find(r => {
      // 简化处理，实际应该查询对方角色名
      return true;
    });
  }
}

// ==================== 简单OC机器人 ====================
class SimpleOCBot {
  constructor(characterId) {
    this.memory = new CharacterMemory(characterId);
    this.character = this.memory.character;
    
    // 回复模板
    this.templates = {
      greeting: [
        '*点头示意* 你来了。',
        '*抬头看向你* 有什么事吗？',
        '嗯，我在这里。'
      ],
      unknown: [
        '*沉思片刻* 这个...让我想想该怎么回答。',
        '这个问题很有意思...',
        '*略微迟疑* 我不太确定该怎么回应。'
      ],
      emotion: {
        happy: ['*微微一笑*', '嘴角轻轻上扬', '眼中闪过一丝暖意'],
        sad: ['*垂下眼帘*', '沉默了片刻', '表情变得有些黯然'],
        angry: ['*眉头紧锁*', '握紧了拳头', '眼中闪过一丝怒火'],
        surprised: ['*睁大眼睛*', '愣了一下', '有些意外']
      }
    };
  }
  
  // 生成回复
  async reply(userMessage) {
    if (!this.character) {
      return '角色数据加载失败，请刷新页面重试。';
    }
    
    // 分析用户消息
    const analysis = this.analyzeMessage(userMessage);
    
    // 获取相关记忆
    const relevantMemories = this.memory.getRelevantMemories(userMessage);
    
    // 生成回复内容
    let response = this.generateResponse(analysis, relevantMemories);
    
    // 添加动作描写
    response = this.addAction(response, analysis.emotion);
    
    // 可能引用记忆
    if (Math.random() < AI_CONFIG.memoryReferenceRate && relevantMemories.length > 0) {
      response += this.generateMemoryReference(relevantMemories);
    }
    
    return response;
  }
  
  // 分析用户消息
  analyzeMessage(message) {
    const analysis = {
      topics: [],
      emotion: null,
      intent: null,
      keywords: []
    };
    
    // 情感分析（简单关键词匹配）
    const emotionKeywords = {
      happy: ['开心', '高兴', '喜欢', '爱', '美好', '幸福', '谢谢', '感谢'],
      sad: ['难过', '伤心', '悲伤', '遗憾', '失去', '离开', '死'],
      angry: ['生气', '愤怒', '讨厌', '恨', '该死', '可恶'],
      surprised: ['惊讶', '意外', '没想到', '竟然', '原来'],
      fear: ['害怕', '恐惧', '担心', '忧虑', '不安']
    };
    
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(kw => message.includes(kw))) {
        analysis.emotion = emotion;
        break;
      }
    }
    
    // 意图分析
    if (message.includes('?') || message.includes('？') || message.includes('什么') || message.includes('怎么') || message.includes('为什么')) {
      analysis.intent = 'question';
    } else if (message.includes('！') || message.includes('!')) {
      analysis.intent = 'exclamation';
    } else {
      analysis.intent = 'statement';
    }
    
    // 提取关键词
    analysis.keywords = message.replace(/[？?！!。，,]/g, '').split(/\s+/);
    
    return analysis;
  }
  
  // 生成回复内容
  generateResponse(analysis, memories) {
    const character = this.character;
    
    // 根据性格标签调整回复风格
    const tags = character.tags || [];
    
    // 基础回复
    let response = '';
    
    // 如果有相关记忆，优先使用
    if (memories.length > 0) {
      const memory = memories[0];
      if (memory.type === 'diary') {
        response = `*陷入回忆* 我记得在日记里写过... "${memory.content.substring(0, 50)}..."`;
      }
    }
    
    // 根据意图生成回复
    if (analysis.intent === 'question') {
      if (tags.includes('勇敢') || tags.includes('正义')) {
        response = this.getTemplate('thoughtful') + '这个问题...';
      } else if (tags.includes('温柔')) {
        response = this.getTemplate('gentle') + '让我想想...';
      }
    }
    
    // 如果没有生成回复，使用默认模板
    if (!response) {
      response = this.getTemplate('unknown');
    }
    
    return response;
  }
  
  // 添加动作描写
  addAction(response, emotion) {
    if (emotion && this.templates.emotion[emotion]) {
      const actions = this.templates.emotion[emotion];
      const action = actions[Math.floor(Math.random() * actions.length)];
      return `${action}\n\n${response}`;
    }
    return response;
  }
  
  // 生成记忆引用
  generateMemoryReference(memories) {
    if (memories.length === 0) return '';
    
    const memory = memories[Math.floor(Math.random() * memories.length)];
    const sources = {
      profile: '档案',
      diary: '日记',
      personality: '性格'
    };
    
    return `\n\n*想起${sources[memory.type] || '记忆'}中的内容*`;
  }
  
  // 获取模板
  getTemplate(type) {
    const templates = this.templates[type] || this.templates.unknown;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  // 检查性格一致性
  checkPersonality(response) {
    // 简单检查回复是否符合角色性格
    // 实际应用中可以使用更复杂的NLP分析
    return true;
  }
}

// ==================== 聊天会话管理 ====================
class ChatSession {
  constructor(characterId) {
    this.characterId = characterId;
    this.bot = new SimpleOCBot(characterId);
    this.history = [];
    this.startTime = new Date();
  }
  
  // 发送消息
  async send(userMessage) {
    // 添加用户消息到历史
    this.history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    
    // 获取AI回复
    const response = await this.bot.reply(userMessage);
    
    // 添加AI回复到历史
    this.history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    
    // 保存到localStorage
    this.save();
    
    return response;
  }
  
  // 保存会话
  save() {
    const chats = JSON.parse(localStorage.getItem('oc_chats') || '[]');
    const existingIndex = chats.findIndex(c => c.characterId === this.characterId);
    
    const sessionData = {
      characterId: this.characterId,
      history: this.history,
      startTime: this.startTime,
      updatedAt: new Date()
    };
    
    if (existingIndex >= 0) {
      chats[existingIndex] = sessionData;
    } else {
      chats.push(sessionData);
    }
    
    localStorage.setItem('oc_chats', JSON.stringify(chats));
  }
  
  // 加载历史会话
  load() {
    const chats = JSON.parse(localStorage.getItem('oc_chats') || '[]');
    const session = chats.find(c => c.characterId === this.characterId);
    
    if (session) {
      this.history = session.history || [];
      this.startTime = new Date(session.startTime);
    }
  }
  
  // 清空会话
  clear() {
    this.history = [];
    this.save();
  }
}

// ==================== 导出 ====================
window.OCAI = {
  CharacterMemory,
  SimpleOCBot,
  ChatSession,
  
  // 快捷方法
  createBot(characterId) {
    return new SimpleOCBot(characterId);
  },
  
  createSession(characterId) {
    return new ChatSession(characterId);
  },
  
  // 简单回复（用于快速测试）
  async quickReply(characterId, message) {
    const bot = new SimpleOCBot(characterId);
    return await bot.reply(message);
  }
};

console.log('🤖 AI聊天模块已加载');
