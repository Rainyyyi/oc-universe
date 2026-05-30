/**
 * OC宇宙 - 专业写作编辑器核心逻辑
 * 
 * 功能：章节管理 / 富文本编辑器 / 自动保存 / 字数统计 / 专注模式
 * 依赖: lucide图标库, OCData 数据代理, pages/story-editor.html 页面结构
 */

// ==================== 全局状态 ====================
const WriterState = {
  storyId: null,
  story: null,
  chapters: [],           // 章节数组（内存中操作）
  activeChapterId: null,  // 当前选中的章节 ID
  isDirty: false,         // 是否有未保存修改
  isSaving: false,        // 正在保存中
  saveTimer: null,        // 自动保存定时器
  focusMode: false,       // 专注模式
  infoTab: 'stats',       // 右侧面板当前 Tab
  targetWords: 50000,     // 目标字数
  todayWordCount: 0,      // 今日新增字数（localStorage）
  // 排版设置
  indentEnabled: true,    // 首行缩进（默认开启，2字符）
  lineHeight: 1.85,       // 行距
  paragraphSpacing: 1.0,  // 段落间距（倍数，基准1em）
};

// ==================== 工具函数 ====================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function generateChapterId() {
  return 'ch_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function countText(text) {
  if (!text) return 0;
  // 去除 HTML 标签后统计字符数
  const tmp = document.createElement('div');
  tmp.innerHTML = text || '';
  const plainText = tmp.textContent || tmp.innerText || '';
  return plainText.replace(/\s/g, '').length; // 去空白后计数（中文习惯）
}

function showToast(msg, type = 'info') {
  let el = document.getElementById('writerToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'writerToast';
    el.className = 'writer-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `writer-toast toast-${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); }, 2800);
}

// ==================== 初始化入口 ====================
async function initWriter() {
  // 从 URL 取 storyId
  const params = new URLSearchParams(window.location.search);
  WriterState.storyId = params.get('storyId');

  if (!WriterState.storyId) {
    showToast('缺少故事ID参数', 'error');
    return;
  }

  // 显示加载态
  showEditorLoading(true);

  try {
    // 加载故事数据
    await loadStory();
    
    // 初始化章节系统
    initChapters();

    // 渲染页面
    renderChapterTree();
    selectFirstChapter();
    renderInfoPanel();
    updateAllStats();
    updateSaveStatus('saved');

    // 绑定事件
    bindEditorEvents();
    bindToolbar();
    bindKeyboardShortcuts();
    bindNavbarTitleEdit();

    // 加载今日字数
    loadTodayWordCount();

    // 加载排版设置
    loadFormatSettings();

    // Lucide 图标 — 局部初始化导航栏（不全局扫描，避免重复渲染）
    try { if (window.lucide) lucide.createIcons({ root: document.querySelector('.writer-navbar') }); } catch(e) {}

    // beforeunload 提示
    window.addEventListener('beforeunload', onBeforeUnload);

  } catch (err) {
    console.error('编辑器初始化失败:', err);
    showToast('加载失败: ' + (err.message || '未知错误'), 'error');
  } finally {
    showEditorLoading(false);
  }
}

// ==================== 故事加载 ====================
async function loadStory() {
  try {
    WriterState.story = await OCData.getStory(WriterState.storyId);
  } catch (e) {
    throw new Error('故事不存在或加载失败');
  }

  if (!WriterState.story) throw new Error('故事数据为空');

  // 从 localStorage 读取扩展属性（type/targetWords 不在 Appwrite 集合字段中）
  const SETTINGS_KEY = 'oc_story_settings_' + WriterState.storyId;
  try {
    const localSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (localSettings.type !== undefined) WriterState.story.type = localSettings.type;
    if (localSettings.targetWords !== undefined) WriterState.targetWords = localSettings.targetWords;
  } catch(e) {}

  // 设置目标字数（如果有设定的话）— 优先用 localStorage 的值
  // （不再从 story 对象读，因为 Appwrite 集合无此字段，只存本地）

  // 更新导航栏标题
  const titleEl = document.getElementById('navTitleInput');
  if (titleEl && WriterState.story.title) {
    titleEl.value = WriterState.story.title;
  }

  // 状态标签
  updateNavStatusTag();
}

function updateNavStatusTag() {
  const tag = document.getElementById('navStatusTag');
  if (!tag || !WriterState.story) return;

  const statusMap = {
    draft: { text: '草稿', cls: 'tag-warning' },
    writing: { text: '写作中', cls: 'tag-primary' },
    completed: { text: '已完成', cls: 'tag-success' }
  };
  const s = statusMap[WriterState.story.status] || statusMap.draft;
  tag.textContent = s.text;
  tag.className = `nav-status-tag ${s.cls}`;
}

// ==================== 章节管理核心 ====================

/**
 * 初始化章节数据
 * 兼容旧数据：如果 chapters 为空，自动将 content 转换为默认章节
 */
function initChapters() {
  let rawChapters = WriterState.story.chapters;

  // 解析 chapters（可能是 JSON 字符串或数组）
  if (typeof rawChapters === 'string') {
    try { rawChapters = JSON.parse(rawChapters); }
    catch(e) { rawChapters = []; }
  }

  if (!rawChapters || !Array.isArray(rawChapters) || rawChapters.length === 0) {
    // 兼容旧数据：将原 content 字段转为默认章节
    const oldContent = WriterState.story.content || '';
    const oldWordCount = WriterState.story.wordCount || countText(oldContent);

    WriterState.chapters = [{
      id: 'default',
      title: '正文',
      type: 'chapter',
      volumeId: null,
      order: 1,
      content: oldContent,
      wordCount: oldWordCount,
      status: oldContent ? 'writing' : 'draft'
    }];
  } else {
    WriterState.chapters = rawChapters.map(ch => ({
      ...ch,
      id: ch.id || generateChapterId(),
      type: ch.type || 'chapter',
      wordCount: ch.wordCount || countText(ch.content),
      status: ch.status || 'draft'
    }));

    // 按 order 排序
    WriterState.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

/** 获取所有卷 */
function getVolumes() {
  return WriterState.chapters.filter(ch => ch.type === 'volume').sort((a, b) => a.order - b.order);
}

/** 获取某卷下的章节 */
function getChaptersInVolume(volumeId) {
  return WriterState.chapters.filter(ch => ch.type === 'chapter' && ch.volumeId === volumeId).sort((a, b) => a.order - b.order);
}

/** 获取根级章节（无卷归属的）*/
function getRootChapters() {
  return WriterState.chapters.filter(ch => ch.type === 'chapter' && !ch.volumeId).sort((a, b) => a.order - b.order);
}

/** 查找章节 */
function findChapter(id) {
  return WriterState.chapters.find(ch => ch.id === id);
}

/** 获取下一个 order 值 */
function getNextOrder() {
  const maxOrder = WriterState.chapters.reduce((max, ch) => Math.max(max, ch.order || 0), 0);
  return maxOrder + 1;
}

// ==================== 章节树渲染 ====================
function renderChapterTree() {
  const tree = document.getElementById('chapterTree');
  if (!tree) return;

  const volumes = getVolumes();
  const rootChapters = getRootChapters();

  if (volumes.length === 0 && rootChapters.length === 0) {
    tree.innerHTML = `<div class="chapter-empty">
      <p>还没有任何章节</p>
      <button class="btn-new-chapter" onclick="showChapterModal()">
        <i data-lucide="Plus" style="width:14px;height:14px;"></i> 创建第一个章节
      </button>
    </div>`;
    try { if (window.lucide) lucide.createIcons({ root: tree }); } catch(e) {}
    return;
  }

  let html = '';

  volumes.forEach(vol => {
    html += renderVolumeNode(vol);
  });

  rootChapters.forEach(ch => {
    html += renderChapterItemNode(ch, false);
  });

  tree.innerHTML = html;

  // 绑定折叠事件
  tree.querySelectorAll('.volume-header').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('collapsed');
      const children = el.nextElementSibling;
      if (children && children.classList.contains('volume-children')) {
        if (el.classList.contains('collapsed')) {
          children.style.maxHeight = '0';
          children.style.overflow = 'hidden';
        } else {
          children.style.maxHeight = children.scrollHeight + 'px';
          children.style.overflow = '';
        }
      }
    });
  });
}

function renderVolumeNode(vol) {
  const subChapters = getChaptersInVolume(vol.id);
  const collapsedClass = ''; // 默认展开

  let childrenHtml = '';
  subChapters.forEach(ch => {
    childrenHtml += renderChapterItemNode(ch, true);
  });

  return `
    <div class="chapter-volume">
      <div class="volume-header" data-volume-id="${vol.id}">
        <i data-lucide="ChevronDown" class="volume-chevron"></i>
        <i data-lucide="Folder" class="volume-icon"></i>
        <span class="volume-title">${escapeHtml(vol.title)}</span>
        <div class="volume-actions">
          <button class="ch-action-btn" onclick="event.stopPropagation();showChapterModal('${vol.id}')" title="添加章节"><i data-lucide="Plus" style="width:13px;height:13px;"></i></button>
          <button class="ch-action-btn" onclick="event.stopPropagation();renameChapter('${vol.id}')" title="重命名"><i data-lucide="Pencil" style="width:13px;height:13px;"></i></button>
          <button class="ch-action-btn danger" onclick="event.stopPropagation();deleteChapterConfirm('${vol.id}')" title="删除"><i data-lucide="Trash2" style="width:13px;height:13px;"></i></button>
        </div>
      </div>
      <div class="volume-children">${childrenHtml}</div>
    </div>`;
}

function renderChapterItemNode(ch, hasParent) {
  const isActive = ch.id === WriterState.activeChapterId;
  const wc = ch.wordCount || 0;
  const wcStr = wc > 0 ? (wc >= 10000 ? (wc / 10000).toFixed(1) + 'w' : wc + '字') : '';

  return `
    <div class="chapter-item ${isActive ? 'active' : ''} ${hasParent ? '' : 'root-level'}"
         data-chapter-id="${ch.id}" onclick="selectChapter('${ch.id}')">
      <i data-lucide="FileText" class="chapter-icon"></i>
      <span class="chapter-title">${escapeHtml(ch.title)}</span>
      ${wcStr ? `<span class="chapter-word-count">${wcStr}</span>` : ''}
      <div class="chapter-actions">
        <button class="ch-action-btn" onclick="event.stopPropagation();moveChapter('${ch.id}', -1)" title="上移"><i data-lucide="ChevronUp" style="width:12px;height:12px;"></i></button>
        <button class="ch-action-btn" onclick="event.stopPropagation();moveChapter('${ch.id}', 1)" title="下移"><i data-lucide="ChevronDown" style="width:12px;height:12px;"></i></button>
        <button class="ch-action-btn" onclick="event.stopPropagation();renameChapter('${ch.id}')" title="重命名"><i data-lucide="Pencil" style="width:12px;height:12px;"></i></button>
        <button class="ch-action-btn danger" onclick="event.stopPropagation();deleteChapterConfirm('${ch.id}')" title="删除"><i data-lucide="Trash2" style="width:12px;height:12px;"></i></button>
      </div>
    </div>`;
}

// ==================== 章节选择与切换 ====================
function selectFirstChapter() {
  // 优先选择第一个 chapter 类型的节点
  const firstChapter = WriterState.chapters.find(ch => ch.type === 'chapter');
  if (firstChapter) {
    selectChapter(firstChapter.id);
  } else {
    // 没有章节时显示空编辑器
    const editor = document.getElementById('editor');
    if (editor) editor.innerHTML = '';
    updateWordCount();
  }
}

function selectChapter(chapterId) {
  const ch = findChapter(chapterId);
  if (!ch) return;

  // 如果有未保存内容，先保存当前章节
  if (WriterState.isDirty && WriterState.activeChapterId) {
    saveCurrentChapterSync();
  }

  // 切换
  WriterState.activeChapterId = chapterId;

  // 加载内容到编辑器
  const editor = document.getElementById('editor');
  if (editor) {
    editor.innerHTML = ch.content || '';
    editor.dataset.placeholder = `正在编写「${ch.title}」...`;
  }

  // 更新高亮
  document.querySelectorAll('.chapter-item').forEach(el => {
    el.classList.toggle('active', el.dataset.chapterId === chapterId);
  });

  // 重置脏标记
  WriterState.isDirty = false;
  updateSaveStatus('saved');
  updateWordCount();

  // 重新应用排版设置（innerHTML 替换后会丢失内联样式）
  applyFormatting();

  // 移动端关闭抽屉
  closeChapterDrawer();
}

// ==================== 章节 CRUD ====================
function showChapterModal(parentVolumeId) {
  const modal = document.getElementById('chapterModal');
  if (!modal) return;

  // 重置表单
  const form = document.getElementById('chapterForm');
  if (form) form.reset();

  const typeSelect = document.getElementById('chTypeSelect');
  const volLabel = document.getElementById('volLabelHint');
  
  if (parentVolumeId) {
    // 在某卷下新建 → 默认是章节
    if (typeSelect) typeSelect.value = 'chapter';
    if (volLabel) volLabel.textContent = `将添加到卷内`;
    modal.dataset.parentVolumeId = parentVolumeId;
  } else {
    // 根级创建
    if (typeSelect) typeSelect.value = 'chapter';
    if (volLabel) volLabel.textContent = '根级创建（可设为卷）';
    delete modal.dataset.parentVolumeId;
  }

  modal.classList.add('active');
  
  setTimeout(() => {
    const input = document.getElementById('chTitleInput');
    if (input) input.focus();
  }, 100);
}

function closeModal_w() {
  const modal = document.getElementById('chapterModal');
  if (modal) modal.classList.remove('active');
}

async function submitChapterForm() {
  const modal = document.getElementById('chapterModal');
  const titleInput = document.getElementById('chTitleInput');
  const typeSelect = document.getElementById('chTypeSelect');
  const parentVolId = modal?.dataset.parentVolumeId || null;

  const title = (titleInput?.value || '').trim();
  const type = typeSelect?.value || 'chapter';

  if (!title) {
    showToast('请输入标题', 'warning');
    return;
  }

  const newChapter = {
    id: generateChapterId(),
    title: title,
    type: type,
    volumeId: type === 'volume' ? null : parentVolId,
    order: getNextOrder(),
    content: '',
    wordCount: 0,
    status: 'draft'
  };

  WriterState.chapters.push(newChapter);

  // 排序
  WriterState.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));

  // 保存到云端
  markDirty();
  await autoSave();

  // 刷新 UI
  renderChapterTree();
  selectChapter(newChapter.id);
  closeModal_w();
  showToast(type === 'volume' ? '卷已创建' : '章节已创建', 'success');

  try { if (window.lucide) lucide.createIcons({ root: document.getElementById('chapterTree') }); } catch(e) {}
}

function renameChapter(chapterId) {
  const ch = findChapter(chapterId);
  if (!ch) return;

  const newTitle = prompt('请输入新名称:', ch.title);
  if (newTitle && newTitle.trim()) {
    ch.title = newTitle.trim();
    renderChapterTree();
    markDirty();
    autoSave();
    // 更新编辑器 placeholder
    const editor = document.getElementById('editor');
    if (editor) editor.dataset.placeholder = `正在编写「${ch.title}」...`;
  }
}

function deleteChapterConfirm(chapterId) {
  const ch = findChapter(chapterId);
  if (!ch) return;

  const confirmMsg = ch.type === 'volume'
    ? `确定删除卷「${ch.title}」及其下所有章节吗？`
    : `确定删除章节「${ch.title}」吗？`;

  if (!confirm(confirmMsg)) return;

  if (ch.type === 'volume') {
    // 删除卷及其下属所有章节
    WriterState.chapters = WriterState.chapters.filter(c =>
      c.id !== chapterId && c.volumeId !== chapterId
    );
  } else {
    WriterState.chapters = WriterState.chapters.filter(c => c.id !== chapterId);
  }

  // 如果删除的是当前选中章节，切到第一个
  if (WriterState.activeChapterId === chapterId) {
    WriterState.activeChapterId = null;
    selectFirstChapter();
  }

  renderChapterTree();
  updateAllStats();
  markDirty();
  autoSave();
  showToast('已删除', 'success');
  try { if (window.lucide) lucide.createIcons({ root: document.getElementById('chapterTree') }); } catch(e) {}
}

function moveChapter(chapterId, direction) {
  const idx = WriterState.chapters.findIndex(c => c.id === chapterId);
  if (idx === -1) return;

  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= WriterState.chapters.length) return;

  // 交换 order
  const temp = WriterState.chapters[idx].order;
  WriterState.chapters[idx].order = WriterState.chapters[newIdx].order;
  WriterState.chapters[newIdx].order = temp;

  // 重排数组
  WriterState.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));

  renderChapterTree();
  markDirty();
  autoSave();
}

// ==================== 编辑器事件绑定 ====================
function bindEditorEvents() {
  const editor = document.getElementById('editor');
  if (!editor) return;

  // 输入事件 → 自动保存触发
  editor.addEventListener('input', () => {
    WriterState.isDirty = true;
    updateSaveStatus('unsaved');
    updateWordCount();
    ensureParagraphFormatting();

    clearTimeout(WriterState.saveTimer);
    WriterState.saveTimer = setTimeout(autoSave, 3000); // 3秒防抖
  });

  // 粘贴事件 → 过滤样式（纯文本粘贴可选）
  editor.addEventListener('paste', (e) => {
    // 默认允许富文本粘贴（写作场景需要格式保留）
  });
}

function bindToolbar() {
  // 格式按钮点击
  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const value = btn.dataset.value || null;

      // 处理 formatBlock
      if (cmd === 'formatBlock') {
        document.execCommand(cmd, false, value);
      } else if (cmd === 'insertHTML') {
        document.execCommand('insertHTML', false, value);
      } else {
        document.execCommand(cmd, false, value);
      }

      // 更新按钮激活状态
      updateToolbarActiveStates();

      // 触发保存
      const editor = document.getElementById('editor');
      if (editor) {
        editor.dispatchEvent(new Event('input'));
      }

      editor.focus();
    });
  });

  // 格式化下拉框
  document.querySelectorAll('.toolbar-select[data-cmd]').forEach(sel => {
    sel.addEventListener('change', () => {
      const cmd = sel.dataset.cmd;
      document.execCommand(cmd, false, sel.value);
      sel.value = '';
      const editor = document.getElementById('editor');
      if (editor) {
        editor.dispatchEvent(new Event('input'));
        editor.focus();
      }
    });
  });
}

function updateToolbarActiveStates() {
  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    let active = false;

    try {
      switch (cmd) {
        case 'bold': active = document.queryCommandState('bold'); break;
        case 'italic': active = document.queryCommandState('italic'); break;
        case 'underline': active = document.queryCommandState('underline'); break;
        case 'strikeThrough': active = document.queryCommandState('strikeThrough'); break;
        case 'insertUnorderedList': active = document.queryCommandState('insertUnorderedList'); break;
        case 'insertOrderedList': active = document.queryCommandState('insertOrderedList'); break;
        case 'justifyLeft':
        case 'justifyCenter':
        case 'justifyRight': active = document.queryCommandState(cmd); break;
      }
    } catch (e) {}

    btn.classList.toggle('active', active);
  });
}

// 光标位置变化时更新工具栏状态
document.addEventListener('selectionchange', () => {
  if (document.getElementById('editor')?.contains(document.activeElement)) {
    updateToolbarActiveStates();
  }
});

// ==================== 导航栏标题编辑 ====================
function bindNavbarTitleEdit() {
  const input = document.getElementById('navTitleInput');
  if (!input) return;

  let typingTimer;
  input.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(async () => {
      const newVal = input.value.trim();
      if (newVal && WriterState.story && WriterState.story.title !== newVal) {
        WriterState.story.title = newVal;
        try {
          await OCData.updateStory(WriterState.storyId, { title: newVal });
        } catch (e) { console.warn('标题保存失败:', e); }
      }
    }, 800); // 标题防抖 800ms
  });
}

// ==================== 快捷键 ====================
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S → 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      autoSave();
      return;
    }

    // F11 / Esc → 专注模式切换
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFocusMode();
      return;
    }

    // Esc → 退出专注模式
    if (e.key === 'Escape' && WriterState.focusMode) {
      toggleFocusMode();
      return;
    }

    // Ctrl+B → 粗体
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false, null);
      return;
    }

    // Ctrl+I → 斜体
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false, null);
      return;
    }

    // Ctrl+U → 下划线
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline', false, null);
      return;
    }
  });
}

// ==================== 排版设置 ====================
const FORMAT_KEY = 'oc_writer_format';

/** 加载排版设置（localStorage） */
function loadFormatSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(FORMAT_KEY) || '{}');
    if (data.indentEnabled !== undefined) WriterState.indentEnabled = data.indentEnabled;
    if (data.lineHeight !== undefined) WriterState.lineHeight = data.lineHeight;
    if (data.paragraphSpacing !== undefined) WriterState.paragraphSpacing = data.paragraphSpacing;
  } catch(e) {}
  applyFormatting();
}

/** 保存排版设置到 localStorage */
function saveFormatSettings() {
  try {
    localStorage.setItem(FORMAT_KEY, JSON.stringify({
      indentEnabled: WriterState.indentEnabled,
      lineHeight: WriterState.lineHeight,
      paragraphSpacing: WriterState.paragraphSpacing
    }));
  } catch(e) {}
}

/** 将排版设置应用到编辑器 */
function applyFormatting() {
  const editor = document.getElementById('editor');
  if (!editor) return;

  // 首行缩进
  editor.style.textIndent = WriterState.indentEnabled ? '2em' : '0';

  // 行距
  editor.style.lineHeight = String(WriterState.lineHeight);

  // 段落间距 — 遍历 p 标签设置 margin
  editor.querySelectorAll('p').forEach(p => {
    p.style.marginBottom = (WriterState.paragraphSpacing * 1) + 'em';
  });

  // 更新工具栏按钮状态
  updateFormatToolbarState();
}

/** 切换首行缩进 */
function toggleIndent() {
  WriterState.indentEnabled = !WriterState.indentEnabled;
  applyFormatting();
  saveFormatSettings();
  showToast(WriterState.indentEnabled ? '已开启首行缩进' : '已关闭首行缩进', 'info');
}

/** 设置行距 */
function setLineHeight(value) {
  WriterState.lineHeight = parseFloat(value);
  applyFormatting();
  saveFormatSettings();
}

/** 设置段落间距 */
function setParagraphSpacing(value) {
  WriterState.paragraphSpacing = parseFloat(value);
  applyFormatting();
  saveFormatSettings();
}

/** 更新工具栏中排版按钮的激活状态 */
function updateFormatToolbarState() {
  const indentBtn = document.getElementById('toolbarIndentBtn');
  if (indentBtn) indentBtn.classList.toggle('active', WriterState.indentEnabled);

  const lhSelect = document.getElementById('toolbarLineHeight');
  if (lhSelect) lhSelect.value = String(WriterState.lineHeight);

  const psSelect = document.getElementById('toolbarParaSpacing');
  if (psSelect) psSelect.value = String(WriterState.paragraphSpacing);
}

/** 确保新段落的排版样式正确 */
function ensureParagraphFormatting() {
  const editor = document.getElementById('editor');
  if (!editor) return;
  editor.querySelectorAll('p').forEach(p => {
    if (p.style.marginBottom === '') {
      p.style.marginBottom = (WriterState.paragraphSpacing * 1) + 'em';
    }
  });
}

// ==================== 字数统计 ====================
function updateWordCount() {
  const editor = document.getElementById('editor');
  if (!editor) return;

  const html = editor.innerHTML || '';
  const wordCount = countText(html);
  const charCount = (html.replace(/<[^>]*>/g, '') || '').length;

  // 更新状态栏
  const wcEl = document.getElementById('statusbarWordCount');
  if (wcEl) wcEl.textContent = wordCount.toLocaleString() + ' 字';

  // 更新右侧面板
  const panelWc = document.getElementById('panelCurrentWc');
  if (panelWc) panelWc.textContent = wordCount.toLocaleString();

  // 更新当前章节字数记录
  if (WriterState.activeChapterId) {
    const ch = findChapter(WriterState.activeChapterId);
    if (ch) ch.wordCount = wordCount;
  }
}

function updateAllStats() {
  const totalWords = WriterState.chapters.reduce((sum, ch) =>
    sum + (ch.type === 'chapter' ? (ch.wordCount || 0) : 0), 0);

  const chapterCount = WriterState.chapters.filter(ch => ch.type === 'chapter').length;
  const progressPct = WriterState.targetWords > 0
    ? Math.min(100, (totalWords / WriterState.targetWords) * 100)
    : 0;

  // 状态栏
  const totalEl = document.getElementById('statusbarTotalWords');
  if (totalEl) totalEl.textContent = '总 ' + totalWords.toLocaleString() + ' 字';

  // 进度条
  const progressFill = document.getElementById('progressBarFill');
  if (progressFill) progressFill.style.width = progressPct.toFixed(1) + '%';

  const progressText = document.getElementById('progressText');
  if (progressText) progressText.textContent = progressPct.toFixed(1) + '%';

  // 右侧面板统计
  const statTotal = document.getElementById('statTotalWords');
  if (statTotal) statTotal.textContent = totalWords.toLocaleString();

  const statChapters = document.getElementById('statChapters');
  if (statChapters) statChapters.textContent = chapterCount;

  const statProgress = document.getElementById('statProgressPct');
  if (statProgress) statProgress.textContent = progressPct.toFixed(1) + '%';

  // 进度环
  updateProgressRing(progressPct);

  // 章节排行列表
  renderChapterRanking();

  // 更新目标字数显示
  const goalEl = document.getElementById('goalDisplay');
  if (goalEl) goalEl.textContent = WriterState.targetWords.toLocaleString();
}

function updateProgressRing(pct) {
  const ring = document.getElementById('progressRingCircle');
  if (!ring) return;

  const circumference = 2 * Math.PI * 45; // r=45
  const offset = circumference - (pct / 100) * circumference;
  ring.style.strokeDashoffset = offset;
}

function renderChapterRanking() {
  const container = document.getElementById('chapterRankingList');
  if (!container) return;

  const chapters = WriterState.chapters
    .filter(ch => ch.type === 'chapter')
    .sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));

  if (chapters.length === 0) {
    container.innerHTML = '<li><span class="cs-name" style="color:var(--text-muted)">暂无章节</span></li>';
    return;
  }

  container.innerHTML = chapters.slice(0, 10).map((ch, i) => `
    <li>
      <span class="cs-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
      <span class="cs-name">${escapeHtml(ch.title)}</span>
      <span class="cs-count">${(ch.wordCount || 0).toLocaleString()}</span>
    </li>
  `).join('');
}

// ==================== 保存机制 ====================
function markDirty() {
  WriterState.isDirty = true;
  updateSaveStatus('unsaved');
}

/** 同步保存当前章节内容到内存（不写磁盘） */
function saveCurrentChapterSync() {
  if (!WriterState.activeChapterId) return;

  const editor = document.getElementById('editor');
  if (!editor) return;

  const ch = findChapter(WriterState.activeChapterId);
  if (ch) {
    ch.content = editor.innerHTML;
    ch.wordCount = countText(editor.innerHTML);
  }
}

/** 异步自动保存（写磁盘） */
async function autoSave() {
  if (WriterState.isSaving) return;
  saveCurrentChapterSync();

  // 检查是否有实际变化需要保存
  if (!WriterState.isDirty) return;

  WriterState.isSaving = true;
  updateSaveStatus('saving');

  try {
    await OCData.updateStory(WriterState.storyId, {
      chapters: JSON.stringify(WriterState.chapters),
      wordCount: getTotalWordCount()
    });
    WriterState.isDirty = false;
    updateSaveStatus('saved');
    recordTodayWordCount();
  } catch (err) {
    console.error('自动保存失败:', err);
    updateSaveStatus('unsaved');
    showToast('保存失败: ' + (err.message || ''), 'error');
  } finally {
    WriterState.isSaving = false;
  }
}

function getTotalWordCount() {
  return WriterState.chapters.reduce((sum, ch) =>
    sum + (ch.type === 'chapter' ? (ch.wordCount || 0) : 0), 0);
}

/** 手动保存（Ctrl+S） */
async function manualSave() {
  await autoSave();
  showToast('已保存', 'success');
}

function updateSaveStatus(status) {
  const indicator = document.getElementById('saveIndicator');
  if (!indicator) return;

  indicator.className = `save-indicator status-${status}`;
  const labels = {
    unsaved: '<span class="save-dot"></span> 未保存',
    saving: '<span class="save-dot"></span> 保存中...',
    saved: '<span class="save-dot"></span> 已保存'
  };
  indicator.innerHTML = labels[status] || labels.unsaved;
}

function onBeforeUnload(e) {
  if (WriterState.isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
}

// ==================== 今日字数统计 ====================
const TODAY_KEY = 'oc_writer_today';

function getTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function loadTodayWordCount() {
  try {
    const data = JSON.parse(localStorage.getItem(TODAY_KEY) || '{}');
    if (data.date === getTodayKey()) {
      WriterState.todayWordCount = data.count || 0;
    } else {
      WriterState.todayWordCount = 0;
    }
  } catch (e) {
    WriterState.todayWordCount = 0;
  }
  updateTodayDisplay();
}

function recordTodayWordCount() {
  const today = getTodayKey();
  const prevData = JSON.parse(localStorage.getItem(TODAY_KEY) || '{}');

  if (prevData.date !== today) {
    prevData.date = today;
    prevData.count = 0;
    prevData.prevBase = getTotalWordCount(); // 记录基准字数
  }

  const currentTotal = getTotalWordCount();
  const base = prevData.prevBase || currentTotal;
  WriterState.todayWordCount = Math.max(0, currentTotal - base);
  prevData.count = WriterState.todayWordCount;
  localStorage.setItem(TODAY_KEY, JSON.stringify(prevData));

  updateTodayDisplay();
}

function updateTodayDisplay() {
  const el = document.getElementById('todayWordCount');
  if (el) el.textContent = WriterState.todayWordCount.toLocaleString() + ' 字';
}

// ==================== 专注模式 ====================
function toggleFocusMode() {
  WriterState.focusMode = !WriterState.focusMode;
  document.body.classList.toggle('focus-mode', WriterState.focusMode);

  const btn = document.getElementById('focusModeBtn');
  if (btn) {
    btn.classList.toggle('active', WriterState.focusMode);
    btn.title = WriterState.focusMode ? '退出专注 (Esc)' : '进入专注写作';
  }

  const hint = document.getElementById('focusExitHint');
  if (hint) hint.style.display = WriterState.focusMode ? 'flex' : 'none';

  showToast(WriterState.focusMode ? '已进入专注模式' : '已退出专注模式', 'info');
}

// ==================== 右侧信息面板 ====================
function switchInfoTab(tabName) {
  WriterState.infoTab = tabName;

  // Tab 按钮高亮
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  renderInfoPanel();
}

function renderInfoPanel() {
  const content = document.getElementById('infoContent');
  if (!content) return;

  switch (WriterState.infoTab) {
    case 'stats': content.innerHTML = renderStatsTab(); break;
    case 'settings': content.innerHTML = renderSettingsTab(); break;
    case 'characters': content.innerHTML = renderCharactersTab(); break;
    default: content.innerHTML = renderStatsTab();
  }

  try { if (window.lucide) lucide.createIcons({ root: content }); } catch(e) {}
  bindSettingsEvents();
}

function renderStatsTab() {
  const totalWords = getTotalWordCount();
  const pct = WriterState.targetWords > 0 ? Math.min(100, (totalWords / WriterState.targetWords) * 100) : 0;
  const circumference = 2 * Math.PI * 45;

  return `
    <!-- 进度环 -->
    <div class="progress-ring-wrapper" style="position:relative;width:120px;height:120px;margin:auto;">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-tertiary)" stroke-width="6"/>
        <circle id="progressRingCircle" cx="50" cy="50" r="45" fill="none" stroke="var(--primary-color)" stroke-width="6"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${circumference - (pct / 100) * circumference}"
                stroke-linecap="round" class="progress-ring-circle"/>
      </svg>
      <span class="progress-ring-text" id="statProgressPct">${pct.toFixed(1)}%</span>
    </div>

    <!-- 总字数 -->
    <div class="stat-card">
      <h4>总字数</h4>
      <div class="stat-big-num" id="statTotalWords">${totalWords.toLocaleString()}</div>
      <div class="stat-sub">目标: <span id="goalDisplay">${WriterState.targetWords.toLocaleString()}</span> 字</div>
    </div>

    <!-- 本章字数 -->
    <div class="stat-card">
      <h4>本章字数</h4>
      <div class="stat-big-num" id="panelCurrentWc">0</div>
      <div class="stat-sub">共 <span id="statChapters">0</span> 个章节</div>
    </div>

    <!-- 今日新增 -->
    <div class="stat-card">
      <h4>今日新增</h4>
      <div class="stat-big-num" style="font-size:1.5rem;" id="todayWordCount">0 字</div>
      <div class="sub">坚持就是胜利！</div>
    </div>

    <!-- 章节排行 -->
    <h4 style="margin:16px 0 8px;font-size:0.82rem;color:var(--text-muted);font-weight:500;">章节排行</h4>
    <ul class="chapter-stats-list" id="chapterRankingList"></ul>
  `;
}

function renderSettingsTab() {
  const s = WriterState.story || {};
  const statusOptions = [
    { val: 'draft', label: '草稿' },
    { val: 'writing', label: '写作中' },
    { val: 'completed', label: '已完成' }
  ];
  const typeOptions = [
    { val: '', label: '未分类' },
    { val: 'epic', label: '史诗' },
    { val: 'adventure', label: '冒险' },
    { val: 'romance', label: '爱情' },
    { val: 'mystery', label: '悬疑' },
    { val: 'tragedy', label: '悲剧' }
  ];

  return `
    <!-- 排版设置 -->
    <div class="setting-group-title">排版设置</div>
    <div class="setting-field">
      <label class="setting-label">首行缩进</label>
      <div class="setting-toggle-row">
        <button class="setting-toggle-btn ${WriterState.indentEnabled ? 'active' : ''}" id="setIndentBtn" onclick="toggleIndent()">
          <i data-lucide="${WriterState.indentEnabled ? 'Check' : 'X'}" style="width:14px;height:14px;"></i>
          ${WriterState.indentEnabled ? '已开启 (2字符)' : '已关闭'}
        </button>
      </div>
    </div>
    <div class="setting-field">
      <label class="setting-label">行距</label>
      <select class="setting-select" id="setLineHeight" onchange="setLineHeight(this.value)">
        <option value="1.2" ${WriterState.lineHeight === 1.2 ? 'selected' : ''}>紧凑 1.2x</option>
        <option value="1.5" ${WriterState.lineHeight === 1.5 ? 'selected' : ''}>较紧 1.5x</option>
        <option value="1.8" ${WriterState.lineHeight === 1.8 ? 'selected' : ''}>舒适 1.8x</option>
        <option value="1.85" ${WriterState.lineHeight === 1.85 ? 'selected' : ''}>标准 1.85x</option>
        <option value="2.0" ${WriterState.lineHeight === 2.0 ? 'selected' : ''}>宽松 2.0x</option>
        <option value="2.5" ${WriterState.lineHeight === 2.5 ? 'selected' : ''}>很宽 2.5x</option>
        <option value="3.0" ${WriterState.lineHeight === 3.0 ? 'selected' : ''}>超宽 3.0x</option>
      </select>
    </div>
    <div class="setting-field">
      <label class="setting-label">段落间距</label>
      <select class="setting-select" id="setParaSpacing" onchange="setParagraphSpacing(this.value)">
        <option value="0.5" ${WriterState.paragraphSpacing === 0.5 ? 'selected' : ''}>紧凑 (0.5em)</option>
        <option value="0.75" ${WriterState.paragraphSpacing === 0.75 ? 'selected' : ''}>较紧 (0.75em)</option>
        <option value="1.0" ${WriterState.paragraphSpacing === 1.0 ? 'selected' : ''}>标准 (1em)</option>
        <option value="1.5" ${WriterState.paragraphSpacing === 1.5 ? 'selected' : ''}>宽松 (1.5em)</option>
        <option value="2.0" ${WriterState.paragraphSpacing === 2.0 ? 'selected' : ''}>很宽 (2em)</option>
      </select>
    </div>

    <!-- 故事设置 -->
    <div class="setting-group-title">故事设置</div>
    <div class="setting-field">
      <label class="setting-label">故事状态</label>
      <select class="setting-select" id="setStatus">
        ${statusOptions.map(o =>
          `<option value="${o.val}" ${s.status === o.val ? 'selected' : ''}>${o.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="setting-field">
      <label class="setting-label">故事类型</label>
      <select class="setting-select" id="setType">
        ${typeOptions.map(o =>
          `<option value="${o.val}" ${s.type === o.val ? 'selected' : ''}>${o.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="setting-field">
      <label class="setting-label">目标字数</label>
      <input type="number" class="setting-input" id="setTargetWords"
             value="${WriterState.targetWords}" min="0" step="1000" placeholder="如: 50000">
    </div>
    <div class="setting-field">
      <label class="setting-label">故事梗概</label>
      <textarea class="setting-textarea" id="setSummary"
                placeholder="简述故事的主要情节...">${escapeHtml(s.summary || s.description || '')}</textarea>
    </div>
    <button class="btn btn-primary" onclick="saveStorySettings()" style="width:100%;margin-top:8px;padding:9px;">
      <i data-lucide="Check" style="width:15px;height:15px;"></i> 保存设置
    </button>
  `;
}

function renderCharactersTab() {
  const chars = WriterState.story.characters || [];
  if (!Array.isArray(chars)) return '<p style="color:var(--text-muted);font-size:0.85rem;">暂无关联角色</p>';

  if (chars.length === 0) {
    return `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px 0;">
      还没有关联角色<br><small>可在故事设置中选择出场角色</small>
    </p>`;
  }

  return `
    <div class="role-tag-list">
      ${chars.map(cid =>
        `<span class="role-tag" title="${cid}">
          <i data-lucide="User" style="width:12px;height:12px;"></i> ${cid}
        </span>`
      ).join('')}
    </div>
    <p style="margin-top:12px;font-size:0.78rem;color:var(--text-muted);">
      共 ${chars.length} 个角色
    </p>
  `;
}

function bindSettingsEvents() {
  // 这些字段在渲染后由用户手动点保存才提交
}

async function saveStorySettings() {
  const status = document.getElementById('setStatus')?.value;
  const type = document.getElementById('setType')?.value;
  const targetWords = parseInt(document.getElementById('setTargetWords')?.value) || 0;
  const summary = document.getElementById('setSummary')?.value?.trim() || '';

  // Appwrite Stories 集合只支持: worldId/title/summary/content/status/wordCount/progress/characters/locations/chapters
  // type 和 targetWords 是编辑器扩展属性，存本地 localStorage
  const SETTINGS_KEY = 'oc_story_settings_' + (WriterState.storyId || '');
  const localSettings = { type, targetWords };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(localSettings)); } catch(e) {}

  try {
    // 只传集合中存在的字段
    await OCData.updateStory(WriterState.storyId, {
      status, summary
    });

    // 更新本地状态
    if (WriterState.story) {
      WriterState.story.status = status;
      WriterState.story.type = type;
      WriterState.story.targetWords = targetWords;
      WriterState.story.summary = summary;
    }
    WriterState.targetWords = targetWords ?? 50000;
    updateNavStatusTag();
    updateAllStats();
    showToast('设置已保存', 'success');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

// ==================== 信息面板浮窗（平板端）====================
function toggleInfoFloat() {
  const panel = document.getElementById('infoPanelFloat');
  if (panel) panel.classList.toggle('active');
}

// ==================== 章节抽屉（移动端）====================
function openChapterDrawer() {
  const drawer = document.getElementById('chapterDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer) drawer.classList.add('active');
  if (overlay) overlay.classList.add('active');
}

function closeChapterDrawer() {
  const drawer = document.getElementById('chapterDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer) drawer.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

// ==================== 加载态 ====================
function showEditorLoading(show) {
  const area = document.querySelector('.writer-editor-area');
  if (!area) return;

  const existing = area.querySelector('.editor-loading');
  if (existing) existing.remove();

  if (show) {
    area.insertAdjacentHTML('afterbegin', `
      <div class="editor-loading">
        <div class="loading-spinner"></div>
        <span>正在加载故事...</span>
      </div>
    `);
  }
}
