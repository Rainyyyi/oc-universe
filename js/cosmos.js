/**
 * 🌌 OC宇宙 - 宇宙星图引擎 v2
 * 世界观 = 发光行星  |  OC = 围绕轨道的星星
 * 支持：拖拽平移、滚轮缩放、悬停交互
 */

;(function(window) {
  'use strict';

  /* ========================================================
     配置
  ======================================================== */
  const CFG = {
    planetSizes:    { sm: 50, md: 66, lg: 84 },   // px
    orbitRadii:     [88, 118, 148],                // 轨道半径 px
    orbitPerRing:   [4, 6, 8],                     // 每圈最多几颗星
    starSizes:      [5, 7, 9],
    starSpeedBase:  0.00028,                        // 公转角速度
    bgStarCount:    280,
    minScale:       0.4,
    maxScale:       2.5,
  };

  // 世界观类型 → 行星颜色
  const TYPE_THEMES = {
    fantasy:    { primary:'#c060ff', glow:'rgba(180,80,255,0.6)',  surface:'rgba(180,80,255,0.35)',  cls:'planet-fantasy'    },
    scifi:      { primary:'#3a9eff', glow:'rgba(50,140,255,0.6)',  surface:'rgba(50,140,255,0.35)',  cls:'planet-scifi'      },
    modern:     { primary:'#20d090', glow:'rgba(30,200,140,0.55)', surface:'rgba(30,200,140,0.3)',   cls:'planet-modern'     },
    historical: { primary:'#f0a040', glow:'rgba(240,160,60,0.6)',  surface:'rgba(240,160,60,0.35)',  cls:'planet-historical' },
    other:      { primary:'#ff70c0', glow:'rgba(255,100,180,0.55)',surface:'rgba(255,100,180,0.3)',  cls:'planet-other'      },
  };

  const STAR_COLORS = [
    '#b8d8ff','#d0c8ff','#ffe0a0','#a0ffcc','#ffc0e0',
    '#80d8ff','#e0b0ff','#fff0a0','#c0f0d8','#ffb0d0',
  ];

  /* ========================================================
     工具
  ======================================================== */
  function rand(a, b)     { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1,3), 16),
      parseInt(hex.slice(3,5), 16),
      parseInt(hex.slice(5,7), 16),
    ];
  }
  function lighten(hex, pct) {
    const [r,g,b] = hexToRgb(hex), f = pct/100;
    return `rgb(${Math.round(r+(255-r)*f)},${Math.round(g+(255-g)*f)},${Math.round(b+(255-b)*f)})`;
  }
  function darken(hex, pct) {
    const [r,g,b] = hexToRgb(hex), f = 1-pct/100;
    return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
  }

  // 把世界观均匀分布到舞台
  function layoutPlanets(n, stageW, stageH) {
    if (n === 0) return [];
    if (n === 1) return [{ x: stageW/2, y: stageH/2 }];
    const positions = [];
    const cx = stageW / 2, cy = stageH / 2;
    const maxR = Math.min(stageW, stageH) * 0.34;
    const ringR = n <= 4 ? maxR * 0.8 : maxR;
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
     背景星空（Canvas）
     参考图配色：深蓝背景 + 白色闪烁星点 + 4尖金色大星 + 蓝白星云流
  ======================================================== */
  class StarField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx    = canvas.getContext('2d');
      this.stars  = [];
      this.bigStars = [];
      this.raf    = null;
      this.t      = 0;
      this._resize();
      this._populate();
      window.addEventListener('resize', () => { this._resize(); this._populate(); });
    }

    _resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    _populate() {
      const W = this.canvas.width, H = this.canvas.height;
      // 普通星点
      this.stars = Array.from({ length: CFG.bgStarCount }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.3, 1.8),
        alpha: rand(0.2, 0.9),
        dA: (Math.random() < 0.5 ? 1 : -1) * rand(0.004, 0.012),
        // 白色为主，少量淡蓝、淡金
        hue: Math.random() < 0.7 ? null
           : Math.random() < 0.5 ? rand(200, 230)  // 淡蓝
           : rand(40, 55),                           // 淡金
      }));

      // 大型四尖亮星（参考图那种明亮十字星芒）
      this.bigStars = [
        { x: W*0.28, y: H*0.12, size: rand(12, 18), phase: 0    },
        { x: W*0.65, y: H*0.08, size: rand(16, 22), phase: 1.2  },
        { x: W*0.82, y: H*0.22, size: rand(10, 14), phase: 2.4  },
        { x: W*0.45, y: H*0.05, size: rand(8,  12), phase: 0.6  },
        { x: W*0.15, y: H*0.30, size: rand(6,  10), phase: 1.8  },
      ];
    }

    start() {
      const tick = () => {
        this.t += 0.006;
        this._draw();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    stop() { cancelAnimationFrame(this.raf); }

    _drawBigStar(ctx, x, y, size, alpha) {
      // 四尖星芒效果
      const arms = 4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);

      // 中心白点
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.3, 'rgba(220,235,255,0.8)');
      cg.addColorStop(1, 'rgba(180,210,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // 十字光芒
      for (let i = 0; i < arms; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / arms);
        const lg = ctx.createLinearGradient(0, -size, 0, size);
        lg.addColorStop(0,   'rgba(220,240,255,0)');
        lg.addColorStop(0.45,'rgba(255,255,255,0.9)');
        lg.addColorStop(0.5, 'rgba(255,255,255,1)');
        lg.addColorStop(0.55,'rgba(255,255,255,0.9)');
        lg.addColorStop(1,   'rgba(220,240,255,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(-0.8, -size, 1.6, size * 2);
        ctx.restore();
      }

      ctx.restore();
    }

    _draw() {
      const { ctx, canvas, t } = this;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ---- 星云层 ---- (参考图：蓝白银流动感)
      // 主星云：中偏左，蓝白
      const g1 = ctx.createRadialGradient(W*0.35, H*0.35, 0, W*0.35, H*0.35, W*0.42);
      g1.addColorStop(0,   'rgba(140,190,255,0.10)');
      g1.addColorStop(0.4, 'rgba(100,160,255,0.05)');
      g1.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // 次星云：右侧，淡紫白
      const g2 = ctx.createRadialGradient(W*0.72, H*0.25, 0, W*0.72, H*0.25, W*0.38);
      g2.addColorStop(0,   'rgba(180,160,255,0.09)');
      g2.addColorStop(0.5, 'rgba(140,130,220,0.04)');
      g2.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // 银河流带：斜向流光（参考图中间蜿蜒的白色流）
      const milkyW = W * 0.06;
      const milkyAngle = -0.4;
      ctx.save();
      ctx.translate(W*0.5, H*0.45);
      ctx.rotate(milkyAngle);
      const mg = ctx.createLinearGradient(-W*0.5, 0, W*0.5, 0);
      mg.addColorStop(0,   'rgba(0,0,0,0)');
      mg.addColorStop(0.3, 'rgba(200,225,255,0.04)');
      mg.addColorStop(0.5, 'rgba(220,240,255,0.09)');
      mg.addColorStop(0.7, 'rgba(200,225,255,0.04)');
      mg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(-W*0.6, -milkyW/2, W*1.2, milkyW);
      ctx.restore();

      // ---- 普通星点 ----
      for (const s of this.stars) {
        s.alpha += s.dA;
        if (s.alpha > 0.95 || s.alpha < 0.08) s.dA *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        if (s.hue !== null) {
          ctx.fillStyle = `hsl(${s.hue},80%,90%)`;
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.globalAlpha = clamp(s.alpha, 0.05, 1);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ---- 大型四尖亮星 ----
      for (const bs of this.bigStars) {
        const alpha = 0.6 + 0.4 * Math.sin(t * 0.8 + bs.phase);
        this._drawBigStar(ctx, bs.x, bs.y, bs.size, alpha);
      }
    }
  }

  /* ========================================================
     轨道OC星星
  ======================================================== */
  class OrbitingStar {
    constructor({ oc, orbitR, speed, angle, colorIdx, stage }) {
      this.oc      = oc;
      this.orbitR  = orbitR;
      this.speed   = speed;
      this.angle   = angle;
      this.color   = STAR_COLORS[colorIdx % STAR_COLORS.length];
      this.size    = CFG.starSizes[Math.floor(Math.random() * CFG.starSizes.length)];
      this.stage   = stage;
      this.el      = null;
      this._build();
    }

    _build() {
      const el = document.createElement('div');
      el.className = 'oc-star';
      el.style.cssText = `width:${this.size}px;height:${this.size}px;--star-color:${this.color};`;

      const dot = document.createElement('div');
      dot.className = 'star-dot';
      dot.style.cssText = `
        background:${this.color};
        box-shadow:0 0 ${this.size*2}px ${this.color},0 0 ${this.size}px rgba(255,255,255,0.5);
      `;

      const tip = document.createElement('div');
      tip.className = 'star-tooltip';
      const ocName = escHtml(this.oc.name || '未命名');
      const ocRole = escHtml(this.oc.role || this.oc.personality || '');
      tip.innerHTML = `<strong>${ocName}</strong>${ocRole ? ocRole : ''}`;

      el.appendChild(dot);
      el.appendChild(tip);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = this.oc.$id || this.oc.id;
        if (id) window.location.href = `pages/characters.html?charId=${id}`;
      });

      this.stage.appendChild(el);
      this.el = el;
    }

    update(dt) {
      this.angle += this.speed * dt;
    }

    render(cx, cy) {
      if (!this.el) return;
      const x = cx + this.orbitR * Math.cos(this.angle);
      const y = cy + this.orbitR * Math.sin(this.angle) * 0.58; // 椭圆感
      this.el.style.left = x + 'px';
      this.el.style.top  = y + 'px';
    }

    destroy() {
      if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    }
  }

  /* ========================================================
     世界观行星
  ======================================================== */
  class WorldPlanet {
    constructor({ world, x, y, chars, stage, onDetail, orbitEls }) {
      this.world    = world;
      this.cx       = x;
      this.cy       = y;
      this.chars    = chars || [];
      this.stage    = stage;
      this.onDetail = onDetail;
      this.orbitEls = orbitEls; // 共享轨道DOM数组
      this.el       = null;
      this.stars    = [];
      this._build();
      this._buildOrbits();
    }

    _theme() {
      return TYPE_THEMES[this.world.type] || TYPE_THEMES.other;
    }

    _size() {
      const n = this.chars.length;
      return n >= 6 ? CFG.planetSizes.lg : n >= 2 ? CFG.planetSizes.md : CFG.planetSizes.sm;
    }

    _build() {
      const th   = this._theme();
      const sz   = this._size();
      const w    = this.world;

      const el = document.createElement('div');
      el.className = `world-planet ${th.cls}`;
      el.style.cssText = `left:${this.cx}px;top:${this.cy}px;`;

      const surfaceAngle = Math.floor(Math.random() * 180);
      el.innerHTML = `
        <div class="planet-wrap">
          <div class="planet-glow" style="width:${sz*1.9}px;height:${sz*1.9}px;background:${th.glow};"></div>
          <div class="planet-core" style="
            width:${sz}px;height:${sz}px;
            background:radial-gradient(circle at 35% 32%,
              ${lighten(th.primary, 38)} 0%,
              ${th.primary} 42%,
              ${darken(th.primary, 22)} 80%,
              ${darken(th.primary, 40)} 100%
            );
            --planet-glow:${th.glow};
            box-shadow:
              inset -6px -6px 16px rgba(0,0,0,0.42),
              inset 4px 4px 10px rgba(255,255,255,0.16),
              0 0 24px ${th.glow},
              0 0 60px ${th.glow.replace('0.6','0.2')};
          ">
            <div class="planet-surface" style="
              background:repeating-linear-gradient(
                ${surfaceAngle}deg,
                transparent 0,transparent 5px,
                ${th.surface} 5px,${th.surface} 6px
              );
            "></div>
          </div>
          ${this.chars.length > 0 ? `<div class="planet-badge">${this.chars.length}</div>` : ''}
        </div>
        <div class="planet-label">${escHtml(w.name)}</div>
      `;

      el.addEventListener('mouseenter', () => this._onEnter());
      el.addEventListener('mouseleave', () => this._onLeave());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onDetail) this.onDetail(w.$id || w.id);
      });

      this.stage.appendChild(el);
      this.el = el;
    }

    _buildOrbits() {
      const perOrbit = CFG.orbitPerRing;
      let idx = 0;
      for (let ring = 0; ring < CFG.orbitRadii.length && idx < this.chars.length; ring++) {
        const orbitR = CFG.orbitRadii[ring];
        const count  = Math.min(perOrbit[ring], this.chars.length - idx);

        // 轨道圆环 DOM：用 left/top 对应行星坐标，CSS transform(-50%,-50%) scaleY(0.6) 负责椭圆
        const orbitEl = document.createElement('div');
        orbitEl.className = 'orbit-ring';
        orbitEl.style.cssText = `
          width:${orbitR * 2}px;
          height:${orbitR * 2}px;
          left:${this.cx}px;
          top:${this.cy}px;
        `;
        this.stage.appendChild(orbitEl);
        if (this.orbitEls) this.orbitEls.push(orbitEl);
        this._orbitDomList = this._orbitDomList || [];
        this._orbitDomList.push(orbitEl);

        for (let i = 0; i < count; i++, idx++) {
          const angle = (i / count) * Math.PI * 2 + rand(0, 0.4);
          const speed = CFG.starSpeedBase * (1 + rand(0, 0.5)) * (ring === 0 ? 1 : 0.72);
          const star  = new OrbitingStar({
            oc: this.chars[idx],
            orbitR,
            speed,
            angle,
            colorIdx: idx,
            stage: this.stage,
          });
          this.stars.push(star);
        }
      }
    }

    _onEnter() {
      CosmosEngine.showHoverCard(this.world, this.chars, this.el);
      // 轨道高亮
      if (this._orbitDomList) {
        this._orbitDomList.forEach(o => o.classList.add('highlight'));
      }
    }

    _onLeave() {
      CosmosEngine.hideHoverCard();
      if (this._orbitDomList) {
        this._orbitDomList.forEach(o => o.classList.remove('highlight'));
      }
    }

    tick(dt) {
      for (const s of this.stars) {
        s.update(dt);
        s.render(this.cx, this.cy);
      }
    }

    destroy() {
      for (const s of this.stars) s.destroy();
      if (this._orbitDomList) {
        this._orbitDomList.forEach(o => { if (o.parentElement) o.parentElement.removeChild(o); });
      }
      if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    }
  }

  /* ========================================================
     主引擎（含拖拽+缩放）
  ======================================================== */
  const CosmosEngine = {
    stage:     null,
    viewport:  null,   // 缩放/平移用的内层容器
    canvas:    null,
    starField: null,
    planets:   [],
    hoverCard: null,
    raf:       null,
    lastTime:  0,

    // 拖拽状态
    _drag: { active: false, startX: 0, startY: 0, origX: 0, origY: 0 },
    // 缩放状态
    _view: { scale: 1, tx: 0, ty: 0 },

    init(stageEl, canvasEl) {
      this.stage  = stageEl;
      this.canvas = canvasEl;

      // 创建 viewport 容器
      let vp = stageEl.querySelector('.cosmos-viewport');
      if (!vp) {
        vp = document.createElement('div');
        vp.className = 'cosmos-viewport';
        stageEl.appendChild(vp);
      }
      this.viewport = vp;

      this.starField = new StarField(canvasEl);
      this.starField.start();
      this._buildHoverCard();
      this._bindDragZoom();
    },

    async render(worlds, charsMap, onDetail) {
      this.clear();
      if (!worlds || worlds.length === 0) return;

      const W = this.viewport.offsetWidth  || this.stage.offsetWidth  || window.innerWidth  - 280;
      const H = this.viewport.offsetHeight || this.stage.offsetHeight || 620;
      const positions = layoutPlanets(worlds.length, W, H);

      for (let i = 0; i < worlds.length; i++) {
        const world = worlds[i];
        const id    = world.$id || world.id;
        const chars = charsMap[id] || [];
        const pos   = positions[i];
        const planet = new WorldPlanet({
          world, chars,
          x: pos.x, y: pos.y,
          stage:    this.viewport,
          onDetail,
        });
        this.planets.push(planet);
      }
      this._startLoop();
    },

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

    /* ---- 拖拽平移 + 滚轮缩放 ---- */
    _bindDragZoom() {
      const stage = this.stage;

      // 滚轮缩放
      stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        this._view.scale = clamp(this._view.scale * factor, CFG.minScale, CFG.maxScale);
        this._applyTransform();
      }, { passive: false });

      // 拖拽平移
      stage.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this._drag.active = true;
        this._drag.startX = e.clientX;
        this._drag.startY = e.clientY;
        this._drag.origX  = this._view.tx;
        this._drag.origY  = this._view.ty;
        stage.classList.add('is-dragging');
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!this._drag.active) return;
        this._view.tx = this._drag.origX + (e.clientX - this._drag.startX);
        this._view.ty = this._drag.origY + (e.clientY - this._drag.startY);
        this._applyTransform();
      });

      window.addEventListener('mouseup', () => {
        if (!this._drag.active) return;
        this._drag.active = false;
        stage.classList.remove('is-dragging');
      });

      // 触摸支持
      let lastTouchDist = 0;
      stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this._drag.active = true;
          this._drag.startX = e.touches[0].clientX;
          this._drag.startY = e.touches[0].clientY;
          this._drag.origX  = this._view.tx;
          this._drag.origY  = this._view.ty;
        } else if (e.touches.length === 2) {
          lastTouchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });

      stage.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && this._drag.active) {
          this._view.tx = this._drag.origX + (e.touches[0].clientX - this._drag.startX);
          this._view.ty = this._drag.origY + (e.touches[0].clientY - this._drag.startY);
          this._applyTransform();
        } else if (e.touches.length === 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (lastTouchDist > 0) {
            const factor = dist / lastTouchDist;
            this._view.scale = clamp(this._view.scale * factor, CFG.minScale, CFG.maxScale);
            this._applyTransform();
          }
          lastTouchDist = dist;
        }
      }, { passive: true });

      stage.addEventListener('touchend', () => {
        this._drag.active = false;
        lastTouchDist = 0;
      });
    },

    _applyTransform() {
      if (!this.viewport) return;
      const { scale, tx, ty } = this._view;
      this.viewport.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    },

    /* ---- 悬浮卡片 ---- */
    _buildHoverCard() {
      // 复用已有
      let card = document.querySelector('.world-hover-card');
      if (!card) {
        card = document.createElement('div');
        card.className = 'world-hover-card';
        document.body.appendChild(card);
      }
      this.hoverCard = card;

      document.addEventListener('mousemove', (e) => {
        if (!this.hoverCard.classList.contains('visible')) return;
        let left = e.clientX + 20;
        let top  = e.clientY - 10;
        if (left + 290 > window.innerWidth)  left = e.clientX - 300;
        if (top  + 210 > window.innerHeight) top  = e.clientY - 190;
        this.hoverCard.style.left = left + 'px';
        this.hoverCard.style.top  = top  + 'px';
      });
    },

    showHoverCard(world, chars, _anchor) {
      if (!this.hoverCard) return;
      const tl = { fantasy:'奇幻', scifi:'科幻', modern:'现代', historical:'古风', other:'其他' };
      const tn = { dark:'黑暗', light:'温馨', neutral:'中性', mixed:'明暗交织' };
      const tags = [];
      if (world.type) tags.push(`<span class="tag">${tl[world.type]||world.type}</span>`);
      if (world.tone) tags.push(`<span class="tag" style="background:rgba(160,130,255,0.14);color:#c0b0ff;border-color:rgba(160,130,255,0.24);">${tn[world.tone]||world.tone}</span>`);
      this.hoverCard.innerHTML = `
        <div class="card-title">${escHtml(world.name)}</div>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
        ${world.description ? `<div class="card-desc">${escHtml(world.description)}</div>` : ''}
        <div class="card-stats">
          <span>✦ ${chars.length} 位角色</span>
          <span>✦ ${world.storyCount || 0} 个故事</span>
        </div>
        <div class="card-hint">点击进入世界 · 星星即角色</div>
      `;
      this.hoverCard.classList.add('visible');
    },

    hideHoverCard() {
      if (this.hoverCard) this.hoverCard.classList.remove('visible');
    },

    clear() {
      cancelAnimationFrame(this.raf);
      for (const p of this.planets) p.destroy();
      this.planets = [];
      if (this.viewport) this.viewport.innerHTML = '';
    },

    destroy() {
      this.clear();
      if (this.starField) this.starField.stop();
      if (this.hoverCard && this.hoverCard.parentElement) {
        this.hoverCard.parentElement.removeChild(this.hoverCard);
      }
    },
  };

  /* ========================================================
     页面集成：挂载宇宙星图视图
  ======================================================== */
  function mountCosmosView(worlds, charsMap) {
    const worldsList = document.getElementById('worldsList');
    if (!worldsList) return;

    const section = worldsList.closest('.worlds-section') || worldsList.parentElement;

    // ---- 清理并重建工具栏 ----
    // 找到原有的工具栏容器（worlds-section 下第一个 .flex.justify-between）
    const oldBar = section.querySelector('.flex.justify-between');
    if (oldBar) {
      // 替换成宇宙风工具栏
      const uiBar = document.createElement('div');
      uiBar.className = 'cosmos-ui-bar';
      uiBar.innerHTML = `
        <h2>我的宇宙</h2>
        <div class="cosmos-ui-bar-right">
          <span class="cosmos-tip">拖拽移动 · 滚轮缩放</span>
          <div class="view-switch" id="viewSwitch">
            <button class="vsw-btn active" id="vsw-cosmos" onclick="CosmosUI.switchView('cosmos')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" opacity="0.5"/></svg>
              星图
            </button>
            <button class="vsw-btn" id="vsw-grid" onclick="CosmosUI.switchView('grid')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              网格
            </button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showCreateWorldModal()" style="white-space:nowrap;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建宇宙
          </button>
        </div>
      `;
      oldBar.parentNode.replaceChild(uiBar, oldBar);
    }

    // ---- 构建星图舞台 ----
    worldsList.innerHTML = `
      <div id="cosmosViewWrap" style="grid-column:1/-1;">
        <div class="cosmos-stage" id="cosmosStage"><div class="cosmos-viewport"></div></div>
      </div>
      <div id="gridViewWrap" style="display:none;grid-column:1/-1;"></div>
    `;

    const stage = document.getElementById('cosmosStage');

    // 初始化引擎（复用已初始化的 viewport 容器）
    CosmosEngine.viewport = stage.querySelector('.cosmos-viewport');
    CosmosEngine.stage    = stage;

    if (!CosmosEngine.starField) {
      CosmosEngine.starField = new StarField(document.getElementById('cosmos-canvas'));
      CosmosEngine.starField.start();
      CosmosEngine._buildHoverCard();
      CosmosEngine._bindDragZoom();
    }

    if (worlds.length === 0) {
      stage.querySelector('.cosmos-viewport').innerHTML = `
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
    } else {
      CosmosEngine.render(worlds, charsMap, function(worldId) {
        if (typeof showWorldDetail === 'function') showWorldDetail(worldId);
      });
    }
  }

  /* ========================================================
     网格视图（传统卡片）
  ======================================================== */
  function mountGridView(worlds) {
    const wrap = document.getElementById('gridViewWrap');
    if (!wrap) return;
    if (!worlds || worlds.length === 0) {
      wrap.innerHTML = '<p style="color:rgba(160,200,255,0.5);text-align:center;padding:3rem;">暂无世界观</p>';
      return;
    }
    const tl = { fantasy:'奇幻', scifi:'科幻', modern:'现代', historical:'古风', other:'其他' };
    const tn = { dark:'黑暗', light:'温馨', neutral:'中性', mixed:'明暗交织' };
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;';
    wrap.innerHTML = worlds.map(w => `
      <div class="card" style="cursor:pointer;" onclick="showWorldDetail('${w.$id||w.id}')">
        <div class="card-cover" style="height:140px;background:rgba(6,16,50,0.7);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--radius-md) var(--radius-md) 0 0;">
          ${w.coverImage
            ? `<img src="${escHtml(w.coverImage)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">`
            : `<span style="font-size:2.5rem;opacity:0.25;">✦</span>`}
        </div>
        <div class="card-body" style="padding:1rem;">
          <h3 style="margin:0 0 0.5rem;">${escHtml(w.name)}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.5rem;">
            ${w.type ? `<span class="badge">${tl[w.type]||w.type}</span>` : ''}
            ${w.tone ? `<span class="badge badge-secondary">${tn[w.tone]||w.tone}</span>` : ''}
          </div>
          ${w.description ? `<p class="text-muted" style="margin:0;font-size:0.8rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(w.description)}</p>` : ''}
          <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.8rem;color:rgba(160,200,255,0.5);">
            <span>${w.characterCount||0} 角色</span>
            <span>${w.storyCount||0} 故事</span>
          </div>
        </div>
        <div class="card-footer" style="padding:0.5rem 1rem;border-top:1px solid rgba(100,160,255,0.1);display:flex;justify-content:flex-end;gap:4px;">
          <button class="btn btn-ghost btn-sm btn-icon" title="编辑" onclick="event.stopPropagation();editWorld('${w.$id||w.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" style="color:rgba(255,100,100,0.7);" title="删除" onclick="event.stopPropagation();deleteWorldConfirm('${w.$id||w.id}','${escHtml(w.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  /* ========================================================
     对外接口
  ======================================================== */
  const CosmosUI = {
    currentView: 'cosmos',
    worlds:   [],
    charsMap: {},

    init(worlds, charsMap) {
      this.worlds   = worlds;
      this.charsMap = charsMap;
      mountCosmosView(worlds, charsMap);
      mountGridView(worlds);
    },

    switchView(view) {
      this.currentView = view;
      const cw = document.getElementById('cosmosViewWrap');
      const gw = document.getElementById('gridViewWrap');
      const bc = document.getElementById('vsw-cosmos');
      const bg = document.getElementById('vsw-grid');
      if (view === 'cosmos') {
        cw && (cw.style.display = '');
        gw && (gw.style.display = 'none');
        bc && bc.classList.add('active');
        bg && bg.classList.remove('active');
      } else {
        cw && (cw.style.display = 'none');
        gw && (gw.style.display = '');
        bc && bc.classList.remove('active');
        bg && bg.classList.add('active');
      }
    },

    refresh(worlds, charsMap) {
      this.worlds   = worlds;
      this.charsMap = charsMap;
      CosmosEngine.clear();
      const vp = document.querySelector('#cosmosStage .cosmos-viewport');
      if (vp) CosmosEngine.viewport = vp;
      if (worlds.length > 0) {
        CosmosEngine.render(worlds, charsMap, function(id) {
          if (typeof showWorldDetail === 'function') showWorldDetail(id);
        });
      } else {
        if (vp) vp.innerHTML = `
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
      mountGridView(worlds);
    },
  };

  window.CosmosEngine = CosmosEngine;
  window.CosmosUI     = CosmosUI;

})(window);
