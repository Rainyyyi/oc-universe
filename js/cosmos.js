/**
 * 🌌 OC宇宙 - 宇宙星图引擎
 * 世界观 = 发光行星  |  OC = 围绕轨道的星星
 */

;(function(window) {
  'use strict';

  /* ========================================================
     配置常量
  ======================================================== */
  const PLANET_SIZES   = { sm: 52, md: 68, lg: 86 };   // px，按角色数量分级
  const ORBIT_RADIUS   = [90, 120, 150];                // 轨道半径(px)，最多3圈
  const STAR_SIZES     = [5, 7, 9];                     // OC星星直径
  const STAR_SPEED_BASE = 0.0003;                        // 公转角速度基值
  const BG_STAR_COUNT  = 220;                           // 背景星点数量

  // 世界观类型 → 行星颜色主题
  const TYPE_THEMES = {
    fantasy:    { primary:'#A855F7', glow:'rgba(168,85,247,0.5)',  surface:'rgba(168,85,247,0.3)',  class:'planet-fantasy'    },
    scifi:      { primary:'#3B82F6', glow:'rgba(59,130,246,0.5)',  surface:'rgba(59,130,246,0.3)',  class:'planet-scifi'      },
    modern:     { primary:'#10B981', glow:'rgba(16,185,129,0.5)',  surface:'rgba(16,185,129,0.3)',  class:'planet-modern'     },
    historical: { primary:'#F59E0B', glow:'rgba(245,158,11,0.5)',  surface:'rgba(245,158,11,0.3)',  class:'planet-historical' },
    other:      { primary:'#EC4899', glow:'rgba(236,72,153,0.5)',  surface:'rgba(236,72,153,0.3)',  class:'planet-other'      },
  };

  // OC星星颜色池（按角色属性随机，或用索引映射）
  const STAR_COLORS = [
    '#93C5FD','#C4B5FD','#F0ABFC','#6EE7B7','#FCD34D',
    '#FB923C','#F87171','#67E8F9','#A3E635','#E879F9',
  ];

  /* ========================================================
     工具函数
  ======================================================== */
  function randBetween(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, lo, hi)  { return Math.max(lo, Math.min(hi, v)); }

  // 将世界观列表均匀分布在舞台上
  function layoutPlanets(worlds, stageW, stageH) {
    const n = worlds.length;
    if (n === 0) return [];
    const positions = [];
    const cx = stageW / 2, cy = stageH / 2;

    // 单个：居中
    if (n === 1) return [{ x: cx, y: cy }];

    // ≤6个：圆形排布
    const ringR = Math.min(stageW, stageH) * 0.3;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      positions.push({
        x: cx + ringR * Math.cos(angle),
        y: cy + ringR * Math.sin(angle),
      });
    }
    return positions;
  }

  /* ========================================================
     背景粒子系统（Canvas）
  ======================================================== */
  class StarField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.stars  = [];
      this.raf    = null;
      this._resize();
      this._populate();
      window.addEventListener('resize', () => this._resize());
    }

    _resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    _populate() {
      this.stars = [];
      for (let i = 0; i < BG_STAR_COUNT; i++) {
        this.stars.push({
          x:    Math.random() * this.canvas.width,
          y:    Math.random() * this.canvas.height,
          r:    randBetween(0.3, 1.5),
          alpha: randBetween(0.2, 0.8),
          dAlpha: (Math.random() < 0.5 ? 1 : -1) * randBetween(0.003, 0.008),
          color: Math.random() < 0.3
            ? `hsl(${randBetween(200,270)},80%,85%)`
            : '#FFFFFF',
        });
      }
    }

    start() {
      const tick = () => {
        this._draw();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    stop() {
      cancelAnimationFrame(this.raf);
    }

    _draw() {
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 极淡星云背景
      const grad = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.4, 0,
        canvas.width * 0.3, canvas.height * 0.4, canvas.width * 0.5
      );
      grad.addColorStop(0,   'rgba(30,15,60,0.15)');
      grad.addColorStop(0.5, 'rgba(10,20,50,0.08)');
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 右侧另一团星云
      const grad2 = ctx.createRadialGradient(
        canvas.width * 0.75, canvas.height * 0.6, 0,
        canvas.width * 0.75, canvas.height * 0.6, canvas.width * 0.35
      );
      grad2.addColorStop(0,   'rgba(10,40,60,0.12)');
      grad2.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 闪烁星点
      for (const s of this.stars) {
        s.alpha += s.dAlpha;
        if (s.alpha > 0.9 || s.alpha < 0.1) s.dAlpha *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = clamp(s.alpha, 0.05, 1);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ========================================================
     轨道粒子（OC星星）
  ======================================================== */
  class OrbitingStar {
    constructor({ oc, orbitR, speed, angle, colorIdx, parentEl }) {
      this.oc     = oc;
      this.orbitR = orbitR;
      this.speed  = speed;
      this.angle  = angle;
      this.colorIdx = colorIdx;
      this.color  = STAR_COLORS[colorIdx % STAR_COLORS.length];
      this.size   = STAR_SIZES[Math.floor(Math.random() * STAR_SIZES.length)];
      this.el     = null;
      this._build(parentEl);
    }

    _build(parent) {
      const el = document.createElement('div');
      el.className = 'oc-star';
      el.style.width  = this.size + 'px';
      el.style.height = this.size + 'px';
      el.style.cssText += `--star-color:${this.color};`;

      const dot = document.createElement('div');
      dot.className = 'star-dot';
      dot.style.cssText = `
        width:100%;height:100%;border-radius:50%;
        background:${this.color};
        box-shadow:0 0 ${this.size * 2}px ${this.color}, 0 0 ${this.size}px rgba(255,255,255,0.6);
      `;

      const tip = document.createElement('div');
      tip.className = 'star-tooltip';
      tip.innerHTML = `<strong>${escHtml(this.oc.name || '未命名')}</strong>${escHtml(this.oc.role || this.oc.personality || '')}`;

      el.appendChild(dot);
      el.appendChild(tip);
      el.addEventListener('click', () => {
        if (this.oc.$id || this.oc.id) {
          window.location.href = `pages/characters.html?charId=${this.oc.$id || this.oc.id}`;
        }
      });

      parent.appendChild(el);
      this.el = el;
    }

    update(dt) {
      this.angle += this.speed * dt;
    }

    render(cx, cy) {
      if (!this.el) return;
      const x = cx + this.orbitR * Math.cos(this.angle);
      const y = cy + this.orbitR * Math.sin(this.angle) * 0.6; // 椭圆
      this.el.style.left = x + 'px';
      this.el.style.top  = y + 'px';
    }

    destroy() {
      if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    }
  }

  /* ========================================================
     行星（世界观）
  ======================================================== */
  class WorldPlanet {
    constructor({ world, x, y, characters, container, onDetail }) {
      this.world   = world;
      this.cx = x; this.cy = y;
      this.chars   = characters || [];
      this.onDetail = onDetail;
      this.el      = null;
      this.stars   = [];
      this.hovered = false;
      this.container = container;
      this._build();
      this._buildOrbits();
    }

    _theme() {
      return TYPE_THEMES[this.world.type] || TYPE_THEMES.other;
    }

    _planetSize() {
      const n = this.chars.length;
      if (n >= 6) return PLANET_SIZES.lg;
      if (n >= 2) return PLANET_SIZES.md;
      return PLANET_SIZES.sm;
    }

    _build() {
      const theme  = this._theme();
      const size   = this._planetSize();
      const world  = this.world;

      const el = document.createElement('div');
      el.className = `world-planet ${theme.class}`;
      el.style.left = this.cx + 'px';
      el.style.top  = this.cy + 'px';
      el.style.cssText += `--planet-color:${theme.primary};`;

      el.innerHTML = `
        <div class="planet-wrap">
          <div class="planet-glow" style="width:${size * 1.8}px;height:${size * 1.8}px;background:${theme.glow};"></div>
          <div class="planet-core" style="width:${size}px;height:${size}px;background:radial-gradient(circle at 35% 35%, ${lighten(theme.primary, 30)} 0%, ${theme.primary} 45%, ${darken(theme.primary, 20)} 100%);">
            <div class="planet-surface" style="background:repeating-linear-gradient(${Math.random()*180}deg,transparent 0,transparent 4px,${theme.surface} 4px,${theme.surface} 5px);"></div>
          </div>
          ${this.chars.length > 0 ? `<div class="planet-badge">${this.chars.length}</div>` : ''}
        </div>
        <div class="planet-label">${escHtml(world.name)}</div>
      `;

      el.addEventListener('mouseenter', () => this._onEnter());
      el.addEventListener('mouseleave', () => this._onLeave());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDetail) this.onDetail(world.$id || world.id);
      });

      this.container.appendChild(el);
      this.el = el;
    }

    _buildOrbits() {
      // 按轨道圈分组星星（每圈最多4个）
      const perOrbit = [4, 6, 8];
      let charIdx = 0;
      for (let ring = 0; ring < ORBIT_RADIUS.length && charIdx < this.chars.length; ring++) {
        const orbitR = ORBIT_RADIUS[ring];
        const count  = Math.min(perOrbit[ring], this.chars.length - charIdx);

        // 轨道圆环
        const orbitEl = document.createElement('div');
        orbitEl.className = 'orbit-ring';
        orbitEl.style.cssText = `
          width:${orbitR * 2}px;
          height:${orbitR * 2 * 0.6}px;
          left:${this.cx}px;
          top:${this.cy}px;
        `;
        this.container.appendChild(orbitEl);

        for (let i = 0; i < count; i++, charIdx++) {
          const char   = this.chars[charIdx];
          const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.3;
          const speed  = STAR_SPEED_BASE * (1 + Math.random() * 0.5) * (ring + 1 < 2 ? 1 : 0.7);
          const star   = new OrbitingStar({
            oc: char,
            orbitR,
            speed,
            angle,
            colorIdx: charIdx,
            parentEl: this.container,
          });
          this.stars.push(star);
        }
      }
    }

    _onEnter() {
      this.hovered = true;
      CosmosEngine.showHoverCard(this.world, this.chars, this.el);
    }

    _onLeave() {
      this.hovered = false;
      CosmosEngine.hideHoverCard();
    }

    tick(dt) {
      for (const star of this.stars) {
        star.update(dt);
        star.render(this.cx, this.cy);
      }
    }

    destroy() {
      for (const star of this.stars) star.destroy();
      if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    }
  }

  /* ========================================================
     辅助：颜色亮化/暗化
  ======================================================== */
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  }

  function lighten(hex, pct) {
    const [r,g,b] = hexToRgb(hex);
    const f = pct/100;
    return `rgb(${Math.round(r+(255-r)*f)},${Math.round(g+(255-g)*f)},${Math.round(b+(255-b)*f)})`;
  }

  function darken(hex, pct) {
    const [r,g,b] = hexToRgb(hex);
    const f = 1 - pct/100;
    return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* ========================================================
     主引擎
  ======================================================== */
  const CosmosEngine = {
    stage:     null,
    canvas:    null,
    starField: null,
    planets:   [],
    hoverCard: null,
    raf:       null,
    lastTime:  0,
    _worldsData: [],
    _charsMap: {},

    /* -- 初始化 -- */
    init(stageEl, canvasEl) {
      this.stage    = stageEl;
      this.canvas   = canvasEl;
      this.starField = new StarField(canvasEl);
      this.starField.start();
      this._buildHoverCard();
    },

    /* -- 加载数据并渲染 -- */
    async render(worlds, charsMap, onDetail) {
      this.clear();
      this._worldsData = worlds;
      this._charsMap   = charsMap;

      if (!worlds || worlds.length === 0) return;

      const stageW = this.stage.offsetWidth  || window.innerWidth  - 280;
      const stageH = this.stage.offsetHeight || 600;

      const positions = layoutPlanets(worlds, stageW, stageH);

      for (let i = 0; i < worlds.length; i++) {
        const world = worlds[i];
        const id    = world.$id || world.id;
        const chars = charsMap[id] || [];
        const pos   = positions[i];

        const planet = new WorldPlanet({
          world,
          x: pos.x, y: pos.y,
          characters: chars,
          container: this.stage,
          onDetail,
        });
        this.planets.push(planet);
      }

      this._startLoop();
    },

    /* -- 动画循环 -- */
    _startLoop() {
      cancelAnimationFrame(this.raf);
      const tick = (ts) => {
        const dt = ts - (this.lastTime || ts);
        this.lastTime = ts;
        for (const p of this.planets) p.tick(dt);
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },

    /* -- 悬浮卡片 -- */
    _buildHoverCard() {
      const div = document.createElement('div');
      div.className = 'world-hover-card';
      document.body.appendChild(div);
      this.hoverCard = div;

      // 跟随鼠标
      document.addEventListener('mousemove', (e) => {
        if (!this.hoverCard.classList.contains('visible')) return;
        const card = this.hoverCard;
        let left = e.clientX + 18;
        let top  = e.clientY - 10;
        if (left + 280 > window.innerWidth)  left = e.clientX - 300;
        if (top  + 200 > window.innerHeight) top  = e.clientY - 180;
        card.style.left = left + 'px';
        card.style.top  = top  + 'px';
      });
    },

    showHoverCard(world, chars, anchorEl) {
      const card = this.hoverCard;
      if (!card) return;
      const typeLabels = { fantasy:'奇幻', scifi:'科幻', modern:'现代', historical:'古风', other:'其他' };
      const toneLabels = { dark:'黑暗', light:'温馨', neutral:'中性', mixed:'明暗交织' };
      const tags = [];
      if (world.type) tags.push(`<span class="tag">${typeLabels[world.type]||world.type}</span>`);
      if (world.tone) tags.push(`<span class="tag" style="background:rgba(167,139,250,0.15);color:#C4B5FD;border-color:rgba(167,139,250,0.25);">${toneLabels[world.tone]||world.tone}</span>`);

      card.innerHTML = `
        <div class="card-title">${escHtml(world.name)}</div>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
        ${world.description ? `<div class="card-desc">${escHtml(world.description)}</div>` : ''}
        <div class="card-stats">
          <span>✦ ${chars.length} 位角色</span>
          <span>📖 ${world.storyCount || 0} 个故事</span>
        </div>
        <div class="card-hint">点击进入世界 · 星星即角色</div>
      `;
      card.classList.add('visible');
    },

    hideHoverCard() {
      if (this.hoverCard) this.hoverCard.classList.remove('visible');
    },

    /* -- 清空 -- */
    clear() {
      cancelAnimationFrame(this.raf);
      for (const p of this.planets) p.destroy();
      this.planets = [];
      // 清除轨道圆环（不在planet内的DOM）
      this.stage.querySelectorAll('.orbit-ring').forEach(el => el.remove());
    },

    /* -- 销毁 -- */
    destroy() {
      this.clear();
      if (this.starField) this.starField.stop();
      if (this.hoverCard && this.hoverCard.parentElement) {
        this.hoverCard.parentElement.removeChild(this.hoverCard);
      }
    },
  };

  /* ========================================================
     页面集成：替换世界观网格为星图
  ======================================================== */
  function mountCosmosView(worlds, charsMap) {
    const worldsList = document.getElementById('worldsList');
    if (!worldsList) return;

    const section = worldsList.closest('.worlds-section') || worldsList.parentElement;

    // 替换头部工具栏
    const toolbarWrap = section.querySelector('.flex.justify-between');
    if (toolbarWrap) {
      toolbarWrap.innerHTML = `
        <h2 style="color:#93C5FD;font-family:var(--font-display);">我的宇宙</h2>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="view-switch" id="viewSwitch">
            <button class="vsw-btn active" id="vsw-cosmos" onclick="CosmosUI.switchView('cosmos')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" opacity="0.4"/><circle cx="12" cy="12" r="6" opacity="0.2"/></svg>
              星图
            </button>
            <button class="vsw-btn" id="vsw-grid" onclick="CosmosUI.switchView('grid')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              网格
            </button>
          </div>
          <select class="form-input" style="width:auto;font-size:0.82rem;" id="sortWorlds">
            <option value="recent">最近更新</option>
            <option value="name">名称排序</option>
            <option value="characters">角色数量</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="showCreateWorldModal()" style="white-space:nowrap;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            创建宇宙
          </button>
        </div>
      `;
    }

    // 构建星图舞台
    worldsList.innerHTML = `
      <div id="cosmosViewWrap" style="grid-column:1/-1;position:relative;">
        <div class="cosmos-stage" id="cosmosStage"></div>
      </div>
      <div id="gridViewWrap" style="display:none;grid-column:1/-1;"></div>
    `;

    // 初始化星图引擎
    const stage = document.getElementById('cosmosStage');
    CosmosEngine.init(stage, document.getElementById('cosmos-canvas'));

    if (worlds.length === 0) {
      // 空态：优美的星云引导
      stage.innerHTML = `
        <div class="cosmos-empty">
          <div class="nebula-ring">
            <span class="nebula-core">✦</span>
          </div>
          <h3>你的宇宙正在诞生</h3>
          <p>每一个世界观都是一座宇宙，每一位角色都是照亮它的星星</p>
          <div class="cosmos-empty-actions">
            <button class="btn btn-primary" onclick="showCreateWorldModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              点燃第一颗星
            </button>
          </div>
        </div>
      `;
    } else {
      CosmosEngine.render(worlds, charsMap, function(worldId) {
        if (typeof showWorldDetail === 'function') showWorldDetail(worldId);
      });
    }
  }

  /* ========================================================
     网格视图（传统卡片，用原有逻辑渲染到 gridViewWrap）
  ======================================================== */
  function mountGridView(worlds) {
    const wrap = document.getElementById('gridViewWrap');
    if (!wrap) return;
    if (!worlds || worlds.length === 0) {
      wrap.innerHTML = '<p style="color:rgba(148,163,184,0.6);text-align:center;padding:3rem;">暂无世界观</p>';
      return;
    }
    const typeLabels = { fantasy:'奇幻', scifi:'科幻', modern:'现代', historical:'古风', other:'其他' };
    const toneLabels = { dark:'黑暗', light:'温馨', neutral:'中性', mixed:'明暗交织' };
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;';
    wrap.innerHTML = worlds.map(w => `
      <div class="card" style="cursor:pointer;" onclick="showWorldDetail('${w.$id||w.id}')">
        <div class="card-cover" style="height:140px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--radius-md) var(--radius-md) 0 0;">
          ${w.coverImage
            ? `<img src="${escHtml(w.coverImage)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">`
            : `<span style="font-size:3rem;color:rgba(96,165,250,0.3);">✦</span>`}
        </div>
        <div class="card-body" style="padding:1rem;">
          <h3 style="margin:0 0 0.5rem;">${escHtml(w.name)}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.5rem;">
            ${w.type ? `<span class="badge">${typeLabels[w.type]||w.type}</span>` : ''}
            ${w.tone ? `<span class="badge badge-secondary">${toneLabels[w.tone]||w.tone}</span>` : ''}
          </div>
          ${w.description ? `<p class="text-muted" style="margin:0;font-size:0.8rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(w.description)}</p>` : ''}
          <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.8rem;color:rgba(148,163,184,0.6);">
            <span>${w.characterCount||0} 角色</span>
            <span>${w.storyCount||0} 故事</span>
          </div>
        </div>
        <div class="card-footer" style="padding:0.5rem 1rem;border-top:1px solid rgba(96,165,250,0.1);display:flex;justify-content:flex-end;gap:4px;">
          <button class="btn btn-ghost btn-sm btn-icon" title="编辑" onclick="event.stopPropagation();editWorld('${w.$id||w.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" style="color:rgba(239,68,68,0.7);" title="删除" onclick="event.stopPropagation();deleteWorldConfirm('${w.$id||w.id}','${escHtml(w.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  /* ========================================================
     视图切换
  ======================================================== */
  const CosmosUI = {
    currentView: 'cosmos',
    worlds: [],
    charsMap: {},

    init(worlds, charsMap) {
      this.worlds   = worlds;
      this.charsMap = charsMap;
      mountCosmosView(worlds, charsMap);
      mountGridView(worlds);
    },

    switchView(view) {
      this.currentView = view;
      const cosmosWrap = document.getElementById('cosmosViewWrap');
      const gridWrap   = document.getElementById('gridViewWrap');
      const vswCosmos  = document.getElementById('vsw-cosmos');
      const vswGrid    = document.getElementById('vsw-grid');

      if (view === 'cosmos') {
        if (cosmosWrap) cosmosWrap.style.display = '';
        if (gridWrap)   gridWrap.style.display = 'none';
        if (vswCosmos)  vswCosmos.classList.add('active');
        if (vswGrid)    vswGrid.classList.remove('active');
      } else {
        if (cosmosWrap) cosmosWrap.style.display = 'none';
        if (gridWrap)   gridWrap.style.display = '';
        if (vswCosmos)  vswCosmos.classList.remove('active');
        if (vswGrid)    vswGrid.classList.add('active');
      }
    },

    // 刷新（数据更新后重建）
    refresh(worlds, charsMap) {
      this.worlds   = worlds;
      this.charsMap = charsMap;
      CosmosEngine.clear();
      if (worlds.length > 0) {
        CosmosEngine.render(worlds, charsMap, function(worldId) {
          if (typeof showWorldDetail === 'function') showWorldDetail(worldId);
        });
      } else {
        const stage = document.getElementById('cosmosStage');
        if (stage) {
          stage.innerHTML = `
            <div class="cosmos-empty">
              <div class="nebula-ring"><span class="nebula-core">✦</span></div>
              <h3>你的宇宙正在诞生</h3>
              <p>每一个世界观都是一座宇宙，每一位角色都是照亮它的星星</p>
              <div class="cosmos-empty-actions">
                <button class="btn btn-primary" onclick="showCreateWorldModal()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  点燃第一颗星
                </button>
              </div>
            </div>
          `;
        }
      }
      mountGridView(worlds);
    },
  };

  // 暴露全局
  window.CosmosEngine = CosmosEngine;
  window.CosmosUI     = CosmosUI;

})(window);
