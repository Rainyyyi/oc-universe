/**
 * 🌌 OC宇宙 - 主应用逻辑
 */

// ==================== 全局配置 ====================
const CONFIG = {
  appName: 'OC宇宙',
  version: '1.0.0',
  defaultTheme: 'light',
  storageKeys: {
    theme: 'oc_theme',
    worlds: 'oc_worlds',
    characters: 'oc_characters',
    stories: 'oc_stories',
    diaries: 'oc_diaries',
    relations: 'oc_relations',
    chats: 'oc_chats',
    settings: 'oc_settings'
  }
};

// ==================== 主题管理 ====================
function initTheme() {
  const savedTheme = localStorage.getItem(CONFIG.storageKeys.theme) || CONFIG.defaultTheme;
  setTheme(savedTheme);
  // 初始化 Lucide 图标
  if (window.lucide) lucide.createIcons();
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(CONFIG.storageKeys.theme, theme);
  
  // 更新主题切换按钮图标
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.setAttribute('title', theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// 绑定主题切换事件
document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // 绑定侧边栏切换
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      if (mainContent) {
        mainContent.classList.toggle('expanded');
      }
    });
  }
});

// ==================== 模态框管理 ====================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// 点击遮罩关闭模态框
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ESC键关闭模态框
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
});

// ==================== 通知系统 ====================
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i data-lucide="${getNotificationIcon(type)}"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">
      <i data-lucide="X"></i>
    </button>
  `;
  
  // 添加样式
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 12px 20px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 3000;
    animation: slideDown 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  // 初始化 Lucide 图标
  if (window.lucide) lucide.createIcons();
  
  // 自动移除
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function getNotificationIcon(type) {
  const icons = {
    success: 'CheckCircle',
    error: 'AlertCircle',
    warning: 'AlertTriangle',
    info: 'Info'
  };
  return icons[type] || icons.info;
}

// ==================== 工具函数 ====================
function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  const now = new Date();
  const diff = now - date;
  
  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }
  // 小于1小时
  if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  }
  // 小于24小时
  if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  }
  // 小于7天
  if (diff < 604800000) {
    return Math.floor(diff / 86400000) + '天前';
  }
  
  // 其他
  return date.toLocaleDateString('zh-CN');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==================== 搜索功能 ====================
function initSearch(inputId, items, renderCallback) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  input.addEventListener('input', debounce(function() {
    const query = this.value.toLowerCase().trim();
    const filtered = items.filter(item => {
      return Object.values(item).some(value => 
        String(value).toLowerCase().includes(query)
      );
    });
    renderCallback(filtered);
  }, 300));
}

// ==================== 图片处理 ====================
function handleImageUpload(file, callback) {
  if (!file || !file.type.startsWith('image/')) {
    showNotification('请选择有效的图片文件', 'error');
    return;
  }
  
  // 检查文件大小 (限制5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('图片大小不能超过5MB', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    callback(e.target.result);
  };
  reader.onerror = function() {
    showNotification('图片读取失败', 'error');
  };
  reader.readAsDataURL(file);
}

// ==================== 导出功能 ====================
function exportToJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename || `export-${new Date().toISOString().split('T')[0]}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function importFromJSON(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        callback(data);
        showNotification('导入成功', 'success');
      } catch (error) {
        showNotification('JSON格式错误', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ==================== 页面导航 ====================
function navigateTo(url) {
  window.location.href = url;
}

function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  return filename.replace('.html', '') || 'index';
}

// ==================== 初始化 ====================
console.log(`🌌 ${CONFIG.appName} v${CONFIG.version} 已加载`);
