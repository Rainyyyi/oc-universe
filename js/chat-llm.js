/**
 * OC宇宙 - 大模型聊天模块
 * 基于AI API的智能对话
 */

// 聊天配置
const CHAT_CONFIG = {
  // 是否启用大模型（false则使用原有规则引擎）
  useLLM: true,
  // 最大历史消息数
  maxHistory: 20,
  // 加载动画延迟
  typingDelay: 1500
};

// 大模型聊天管理器
class LLMChatManager {
  constructor(characterId, worldId) {
    this.characterId = characterId;
    this.worldId = worldId;
    this.history = [];
    this.isLoading = false;
  }

  // 发送消息并获取回复
  async sendMessage(message) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    try {
      // 调用后端API
      const response = await window.API.chats.sendAI(
        this.characterId,
        this.worldId,
        message,
        this.history
      );
      
      // 更新历史记录
      this.history.push({ role: 'user', content: message });
      this.history.push({ role: 'assistant', content: response.response });
      
      // 限制历史长度
      if (this.history.length > CHAT_CONFIG.maxHistory * 2) {
        this.history = this.history.slice(-CHAT_CONFIG.maxHistory * 2);
      }
      
      return {
        success: true,
        response: response.response,
        character: response.character
      };
    } catch (error) {
      console.error('AI聊天错误:', error);
      return {
        success: false,
        error: error.message,
        // 降级到规则引擎
        fallback: true
      };
    } finally {
      this.isLoading = false;
    }
  }

  // 加载历史聊天记录
  async loadHistory(limit = 50) {
    try {
      const chats = await window.API.chats.getAll(this.characterId, limit);
      
      // 转换为消息历史格式
      this.history = chats
        .filter(chat => chat.role === 'user' || chat.role === 'assistant')
        .map(chat => ({
          role: chat.role === 'assistant' ? 'assistant' : 'user',
          content: chat.content
        }));
      
      return this.history;
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      return [];
    }
  }

  // 清除聊天历史
  clearHistory() {
    this.history = [];
  }
}

// 聊天UI管理器
class ChatUI {
  constructor() {
    this.currentManager = null;
    this.messageContainer = null;
    this.inputElement = null;
    this.sendButton = null;
    this.typingIndicator = null;
  }

  // 初始化聊天UI
  init() {
    this.messageContainer = document.getElementById('chat-messages');
    this.inputElement = document.getElementById('chat-input');
    this.sendButton = document.getElementById('send-btn');
    
    // 绑定事件
    if (this.sendButton) {
      this.sendButton.addEventListener('click', () => this.handleSend());
    }
    
    if (this.inputElement) {
      this.inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });
    }
  }

  // 设置当前聊天角色
  setCharacter(characterId, worldId) {
    this.currentManager = new LLMChatManager(characterId, worldId);
    this.loadHistory();
  }

  // 加载历史记录
  async loadHistory() {
    if (!this.currentManager) return;
    
    const history = await this.currentManager.loadHistory();
    this.renderHistory(history);
  }

  // 渲染历史消息
  renderHistory(messages) {
    if (!this.messageContainer) return;
    
    this.messageContainer.innerHTML = '';
    
    messages.forEach(msg => {
      this.appendMessage(msg.content, msg.role === 'assistant' ? 'ai' : 'user');
    });
  }

  // 处理发送消息
  async handleSend() {
    const message = this.inputElement?.value?.trim();
    if (!message || !this.currentManager) return;
    
    // 清空输入框
    this.inputElement.value = '';
    
    // 显示用户消息
    this.appendMessage(message, 'user');
    
    // 显示加载状态
    this.showTyping();
    
    try {
      const result = await this.currentManager.sendMessage(message);
      
      this.hideTyping();
      
      if (result.success) {
        this.appendMessage(result.response, 'ai');
      } else if (result.fallback) {
        // 降级到规则引擎
        this.appendMessage('抱歉，我现在有点累了...让我想想...', 'ai');
      } else {
        this.appendMessage(`错误: ${result.error}`, 'ai');
      }
    } catch (error) {
      this.hideTyping();
      this.appendMessage('发送失败，请重试。', 'ai');
    }
  }

  // 添加消息到界面
  appendMessage(content, type) {
    if (!this.messageContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    
    const avatar = type === 'ai' ? '🤖' : '👤';
    const time = new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-text">${this.formatMessage(content)}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
    
    this.messageContainer.appendChild(messageDiv);
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  // 格式化消息（支持简单Markdown）
  formatMessage(text) {
    // 转义HTML
    let formatted = text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
    
    // 粗体
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 换行
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  // 显示正在输入
  showTyping() {
    if (!this.messageContainer) return;
    
    this.typingIndicator = document.createElement('div');
    this.typingIndicator.className = 'message message-ai typing';
    this.typingIndicator.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    
    this.messageContainer.appendChild(this.typingIndicator);
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  // 隐藏正在输入
  hideTyping() {
    if (this.typingIndicator) {
      this.typingIndicator.remove();
      this.typingIndicator = null;
    }
  }
}

// 导出到全局
window.LLMChatManager = LLMChatManager;
window.ChatUI = ChatUI;
