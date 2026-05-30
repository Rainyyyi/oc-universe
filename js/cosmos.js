/**
 * 🌌 OC宇宙 - 宇宙星图引擎 v3
 * 世界观 = 发光行星  |  OC = 围绕轨道的星星
 * 配色：浅蓝紫梦幻银河
 * 支持：拖拽平移、滚轮缩放、随机散落布局、悬停交互
 */

;(function(window) {
  'use strict';

  /* ========================================================
     配置
  ======================================================== */
  const CFG = {
    planetSizes:    { sm: 50, md: 66, lg: 84 },
    orbitRadii:     [82, 112, 148, 190, 238],
    orbitPerRing:   [3, 4, 5, 7, 11],
    starSizes:      [5, 7, 9],
    starSpeedBase:  0.00028,
    bgStarCount:    420,            // 大幅增加星点
    bigStarCount:   12,             // 更多大亮星
    minScale:       0.4,
    maxScale:       2.5,
  };

  // 世界观类型 → 行星颜色
  const TYPE_THEMES = {
    fantasy:    { primary:'#7a38d8', glow:'rgba(130,80,220,0.55)',  surface:'rgba(130,80,220,0.3)',   cls:'planet-fantasy'    },
    scifi:      { primary:'#3878e8', glow:'rgba(60,130,240,0.5)',   surface:'rgba(60,130,240,0.3)',   cls:'planet-scifi'      },
    modern:     { primary:'#18b878', glow:'rgba(24,180,120,0.5)',   surface:'rgba(24,180,120,0.25)',  cls:'planet-modern'     },
    historical: { primary:'#e08830', glow:'rgba(220,130,40,0.55)',  surface:'rgba(220,130,40,0.3)',   cls:'planet-historical' },
    other:      { primary:'#e850a0', glow:'rgba(230,80,150,0.5)',   surface:'rgba(230,80,150,0.25)',  cls:'planet-other'      },
  };

  const STAR_COLORS = [
    '#fff','#fff','#ffe8c0','#d0e0ff','#ffd0e8',
    '#fff','#ffe0a0','#c0d8ff','#e8d0ff','#ffd8e0',
    '#fff','#ffd8b0','#b8d8ff',
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

  /* ========================================================
     行星随机散落布局
     不再是完美的环形排列，加入随机偏移和半径变化
  ======================================================== */
  function layoutPlanets(n, stageW, stageH) {
    if (n === 0) return [];
    if (n === 1) return [{ x: stageW/2 + rand(-30, 30), y: stageH/2 + rand(-20, 20) }];

    const positions = [];
    const cx = stageW / 2, cy = stageH / 2;
    const maxR = Math.min(stageW, stageH) * 0.34;

    for (let i = 0; i < n; i++) {
      // 随机半径：在 maxR 的 45%~100% 之间随机
      const r = maxR * rand(0.45, 1.0);
      // 角度均匀分布但加入随机偏移 (±30°)
      const baseAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const jitter = rand(-0.55, 0.55); // ±约31°
      const angle = baseAngle + jitter;

      positions.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    }

    // 利用力导向思想再做一次微调，避免行星重叠
    const minDist = 130; // 最小间距
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const dist = Math.hypot(dx, dy);
          if (dist < minDist && dist > 0.01) {
            const push = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            positions[i].x -= nx * push;
            positions[i].y -= ny * push;
            positions[j].x += nx * push;
            positions[j].y += ny * push;
          }
        }
      }
      // 限制在舞台内
      for (let i = 0; i < n; i++) {
        positions[i].x = clamp(positions[i].x, 50, stageW - 50);
        positions[i].y = clamp(positions[i].y, 50, stageH - 50);
      }
    }

    return positions;
  }

  /* ========================================================
     背景星空（Canvas）
     参考图风格：大量白色+金色星点，大亮星闪烁，浅蓝紫星云
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

      // 普通星点：大幅增加，更多白色+金色
      this.stars = Array.from({ length: CFG.bgStarCount }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.3, 2.2),
        alpha: rand(0.15, 0.95),
        dA: (Math.random() < 0.5 ? 1 : -1) * rand(0.003, 0.015),
        hue: Math.random() < 0.55 ? null          // 纯白
           : Math.random() < 0.5 ? rand(200, 235) // 淡蓝
           : rand(38, 55),                         // 金色
      }));

      // 大型亮点（参考图那种闪耀的大星）
      this.bigStars = [];
      for (let i = 0; i < CFG.bigStarCount; i++) {
        this.bigStars.push({
          x: rand(W * 0.02, W * 0.98),
          y: rand(H * 0.02, H * 0.45), // 集中在上半部
          size: rand(7, 24),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.3, 1.2),
          hue: Math.random() < 0.6 ? null : rand(40, 55),
        });
      }
    }

    start() {
      const tick = () => {
        this.t += 0.005;
        this._draw();
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    stop() { cancelAnimationFrame(this.raf); }

    _drawBigStar(ctx, x, y, size, alpha, hue) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);

      // 光晕
      const glowHue = hue || 0;
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.15, `hsl(${glowHue},90%,85%)`);
      cg.addColorStop(0.5, `hsla(${glowHue},90%,80%,0.5)`);
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // 四尖星芒
      const arms = 4;
      for (let i = 0; i < arms; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / arms);
        const lg = ctx.createLinearGradient(0, -size * 1.2, 0, size * 1.2);
        lg.addColorStop(0,   'rgba(255,255,255,0)');
        lg.addColorStop(0.44,'rgba(255,255,255,0.85)');
        lg.addColorStop(0.5, 'rgba(255,255,255,1)');
        lg.addColorStop(0.56,'rgba(255,255,255,0.85)');
        lg.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(-0.7, -size * 1.2, 1.4, size * 2.4);
        ctx.restore();
      }
      ctx.restore();
    }

    _draw() {
      const { ctx, canvas, t } = this;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ---- 星云层（参考图：浅蓝+薰衣草紫） ----
      // 主星云：中上部，淡蓝白
      const g1 = ctx.createRadialGradient(W*0.32, H*0.28, 0, W*0.32, H*0.28, W*0.5);
      g1.addColorStop(0,   'rgba(200,225,255,0.12)');
      g1.addColorStop(0.35,'rgba(170,200,240,0.07)');
      g1.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // 次星云：右中，薰衣草紫
      const g2 = ctx.createRadialGradient(W*0.7, H*0.35, 0, W*0.7, H*0.35, W*0.4);
      g2.addColorStop(0,   'rgba(210,190,240,0.10)');
      g2.addColorStop(0.45,'rgba(180,160,225,0.05)');
      g2.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // 第三星云：左上，柔粉
      const g3 = ctx.createRadialGradient(W*0.18, H*0.12, 0, W*0.18, H*0.12, W*0.35);
      g3.addColorStop(0,   'rgba(255,220,230,0.08)');
      g3.addColorStop(0.5, 'rgba(240,200,220,0.03)');
      g3.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, W, H);

      // 银河斜带
      const mw = W * 0.05;
      const ma = -0.35;
      ctx.save();
      ctx.translate(W*0.48, H*0.38);
      ctx.rotate(ma);
      const mg = ctx.createLinearGradient(-W*0.5, 0, W*0.5, 0);
      mg.addColorStop(0,   'rgba(0,0,0,0)');
      mg.addColorStop(0.28,'rgba(210,230,255,0.04)');
      mg.addColorStop(0.5, 'rgba(230,240,255,0.10)');
      mg.addColorStop(0.72,'rgba(210,230,255,0.04)');
      mg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(-W*0.6, -mw/2, W*1.2, mw);
      ctx.restore();

      // ---- 普通星点 ----
      for (const s of this.stars) {
        s.alpha += s.dA;
        if (s.alpha > 0.95 || s.alpha < 0.05) s.dA *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        if (s.hue !== null) {
          ctx.fillStyle = `hsl(${s.hue},80%,88%)`;
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.globalAlpha = clamp(s.alpha, 0.04, 1);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ---- 大型亮星 ----
      for (const bs of this.bigStars) {
        const alpha = 0.55 + 0.45 * Math.sin(t * bs.speed + bs.phase);
        this._drawBigStar(ctx, bs.x, bs.y, bs.size, alpha, bs.hue);
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
        box-shadow:0 0 ${this.size*2.5}px ${this.color},0 0 ${this.size*1.2}px rgba(255,255,255,0.6);
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
      const y = cy + this.orbitR * Math.sin(this.angle) * 0.58;
      this.el.style.left = x + 'px';
      this.el.style.top  = y + 'px';
    }

    destroy() {
      if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    }
  }

  /* ========================================================
     世界观行星（不带badge数字）
  ======================================================== */
  /* ========================================================
     星球纹理 —— 返回一个独立子 div 的 HTML 字符串
     此 div 放在 planet-core 内部，position:absolute 铺满整个圆形
     不再依赖 background 层叠，避免被伪元素/渲染引擎吞掉
  ======================================================== */
  function _buildPlanetTextureDiv(th, type) {
    const p = th.primary;
    // 用极高对比度的颜色：亮色 > 底色很多，暗色 < 底色很多
    const bright = lighten(p, 70);   // 亮条
    const dark   = darken(p, 75);    // 暗条
    const mid    = lighten(p, 30);   // 中亮

    let stripes;
    switch (type) {
      case 'fantasy':
        // 粗斜条纹：亮/暗交替 + 透明留白
        stripes = `repeating-linear-gradient(135deg,
          ${bright} 0px, ${bright} 12px,
          ${dark} 12px, ${dark} 24px,
          transparent 24px, transparent 28px,
          ${mid} 28px, ${mid} 34px,
          ${dark} 34px, ${dark} 40px,
          transparent 40px, transparent 48px)`;
        break;
      case 'scifi':
        // 水平粗细条纹
        stripes = `repeating-linear-gradient(0deg,
          ${bright} 0px, ${bright} 10px,
          ${dark} 10px, ${dark} 18px,
          transparent 18px, transparent 22px,
          ${mid} 22px, ${mid} 28px,
          ${dark} 28px, ${dark} 36px,
          transparent 36px, transparent 44px)`;
        break;
      case 'modern':
        // 垂直条纹
        stripes = `repeating-linear-gradient(90deg,
          ${bright} 0px, ${bright} 8px,
          ${dark} 8px, ${dark} 16px,
          transparent 16px, transparent 20px,
          ${mid} 20px, ${mid} 26px,
          ${dark} 26px, ${dark} 32px,
          transparent 32px, transparent 42px)`;
        break;
      case 'historical':
        // 十字交叉网格纹
        stripes = `repeating-linear-gradient(45deg,
          ${bright} 0px, ${bright} 8px,
          ${dark} 8px, ${dark} 14px,
          transparent 14px, transparent 18px),
        repeating-linear-gradient(-45deg,
          ${mid} 0px, ${mid} 6px,
          ${dark} 6px, ${dark} 12px,
          transparent 12px, transparent 18px)`;
        break;
      case 'other':
      default:
        // 圆斑纹理
        stripes = `radial-gradient(circle at 18% 22%, ${bright} 12px, transparent 13px),
        radial-gradient(circle at 72% 20%, ${dark} 14px, transparent 15px),
        radial-gradient(circle at 42% 55%, ${mid} 11px, transparent 12px),
        radial-gradient(circle at 80% 62%, ${bright} 13px, transparent 14px),
        radial-gradient(circle at 25% 75%, ${dark} 10px, transparent 11px),
        radial-gradient(circle at 60% 80%, ${mid} 12px, transparent 13px),
        radial-gradient(circle at 85% 42%, ${bright} 10px, transparent 11px),
        radial-gradient(circle at 15% 50%, ${dark} 9px, transparent 10px),
        radial-gradient(circle at 52% 18%, ${mid} 12px, transparent 13px),
        radial-gradient(circle at 68% 88%, ${bright} 11px, transparent 12px)`;
        break;
    }

    return `<div class="planet-texture" style="
  position:absolute;inset:0;border-radius:50%;overflow:hidden;
  background:${stripes};
  opacity:0.9;
"></div>`;
  }

  // 各世界观类型 → 旋转速度/方向
  const PLANET_ROTATE = {
    fantasy:    'animation:planet-rotate 18s linear infinite',
    scifi:      'animation:planet-rotate 28s linear infinite reverse',
    modern:     'animation:planet-rotate 22s linear infinite',
    historical: 'animation:planet-rotate 32s linear infinite',
    other:      'animation:planet-rotate 20s linear infinite reverse',
  };

  class WorldPlanet {
    constructor({ world, x, y, chars, stage, onDetail, orbitEls }) {
      this.world    = world;
      this.cx       = x;
      this.cy       = y;
      this.chars    = chars || [];
      this.stage    = stage;
      this.onDetail = onDetail;
      this.orbitEls = orbitEls;
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
      const th = this._theme();
      const sz = this._size();
      const w  = this.world;

      const el = document.createElement('div');
      el.className = `world-planet ${th.cls}`;
      el.style.cssText = `left:${this.cx}px;top:${this.cy}px;`;

      const rotAnim = PLANET_ROTATE[w.type] || PLANET_ROTATE.other;
      // 底色只保留径向渐变
      const baseBG = `radial-gradient(circle at 35% 32%,
            ${lighten(th.primary, 40)} 0%,
            ${th.primary} 42%,
            ${darken(th.primary, 22)} 80%,
            ${darken(th.primary, 42)} 100%
          )`;
      el.innerHTML = `
        <div class="planet-wrap" style="${rotAnim};">
          <div class="planet-glow" style="width:${sz*1.9}px;height:${sz*1.9}px;background:${th.glow};"></div>
          <div class="planet-core" style="
            width:${sz}px;height:${sz}px;
            background:${baseBG};
            --planet-glow:${th.glow};
            box-shadow:
              inset -5px -5px 14px rgba(0,0,0,0.35),
              inset 3px 3px 8px rgba(255,255,255,0.22),
              0 0 20px ${th.glow},
              0 0 50px ${th.glow.replace('0.55','0.2').replace('0.5','0.18')};
          ">
            ${_buildPlanetTextureDiv(th, w.type)}
          </div>
        </div>
        <div class="planet-label">${escHtml(w.name)}</div>
      `;

      // 星球拖拽（mousedown 启动，mousemove 控制，mouseup 结束）
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        CosmosEngine._planetDrag = {
          planet: this,
          startX: e.clientX,
          startY: e.clientY,
          origCx: this.cx,
          origCy: this.cy,
          moved: false,
        };
        this.stage.classList.add('is-dragging');
      });

      el.addEventListener('mouseenter', () => this._onEnter());
      el.addEventListener('mouseleave', () => this._onLeave());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // 刚拖拽过，跳过导航
        if (CosmosEngine._planetDragWasMoved) {
          CosmosEngine._planetDragWasMoved = false;
          return;
        }
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
          const angle = (i / count) * Math.PI * 2 + rand(0, 0.5);
          const speed = CFG.starSpeedBase * (1 + rand(0, 0.6)) * (ring === 0 ? 1 : 0.7);
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

    moveTo(cx, cy) {
      this.cx = cx;
      this.cy = cy;
      if (this.el) {
        this.el.style.left = cx + 'px';
        this.el.style.top = cy + 'px';
      }
      // 同步移动轨道环
      if (this._orbitDomList) {
        this._orbitDomList.forEach(o => {
          o.style.left = cx + 'px';
          o.style.top = cy + 'px';
        });
      }
    }

    _onEnter() {
      CosmosEngine.showHoverCard(this.world, this.chars, this.el);
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
    viewport:  null,
    canvas:    null,
    starField: null,
    planets:   [],
    hoverCard: null,
    raf:       null,
    lastTime:  0,

    _drag: { active: false, startX: 0, startY: 0, origX: 0, origY: 0 },
    _view: { scale: 1, tx: 0, ty: 0 },
    _planetDrag: null,
    _planetDragWasMoved: false,
    _unbindDragZoom: null,

    init(stageEl, canvasEl) {
      this.stage  = stageEl;
      this.canvas = canvasEl;

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

    /* ---- 拖拽平移 + 滚轮缩放（支持单独拖拽星球） ---- */
    _bindDragZoom() {
      // 清除旧绑定，防止事件重复
      if (this._unbindDragZoom) this._unbindDragZoom();

      const stage = this.stage;
      const listeners = [];

      const on = (el, type, fn, opts) => {
        el.addEventListener(type, fn, opts);
        listeners.push({ el, type, fn, opts });
      };

      // ---- 滚轮缩放 ----
      on(stage, 'wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        this._view.scale = clamp(this._view.scale * factor, CFG.minScale, CFG.maxScale);
        this._applyTransform();
      }, { passive: false });

      // ---- 鼠标按下（空白区域平移视口，星球上则交给星球自身处理） ----
      const mdHandler = (e) => {
        if (e.button !== 0) return;
        // 点到了星球 → 不启动视口拖拽
        if (e.target.closest('.world-planet')) return;
        this._drag.active = true;
        this._drag.startX = e.clientX;
        this._drag.startY = e.clientY;
        this._drag.origX  = this._view.tx;
        this._drag.origY  = this._view.ty;
        stage.classList.add('is-dragging');
        e.preventDefault();
      };
      on(stage, 'mousedown', mdHandler);

      // ---- 鼠标移动（星球拖拽优先） ----
      const mmHandler = (e) => {
        // 星球拖拽
        if (this._planetDrag) {
          const scale = this._view.scale;
          const dx = (e.clientX - this._planetDrag.startX) / scale;
          const dy = (e.clientY - this._planetDrag.startY) / scale;
          this._planetDrag.planet.moveTo(
            this._planetDrag.origCx + dx,
            this._planetDrag.origCy + dy
          );
          this._planetDrag.moved = true;
          return;
        }
        // 视口平移
        if (!this._drag.active) return;
        this._view.tx = this._drag.origX + (e.clientX - this._drag.startX);
        this._view.ty = this._drag.origY + (e.clientY - this._drag.startY);
        this._applyTransform();
      };
      on(window, 'mousemove', mmHandler);

      // ---- 鼠标释放 ----
      const muHandler = () => {
        if (this._planetDrag) {
          if (this._planetDrag.moved) {
            this._planetDragWasMoved = true;
          }
          this._planetDrag = null;
        }
        if (this._drag.active) {
          this._drag.active = false;
          stage.classList.remove('is-dragging');
        }
      };
      on(window, 'mouseup', muHandler);

      // ---- 触摸手势（暂不支持星球触屏拖拽，仅视口手势） ----
      let lastTouchDist = 0;
      on(stage, 'touchstart', (e) => {
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

      on(stage, 'touchmove', (e) => {
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

      on(stage, 'touchend', () => {
        this._drag.active = false;
        lastTouchDist = 0;
      });

      // 保存清理函数
      this._unbindDragZoom = () => {
        for (const { el, type, fn, opts } of listeners) {
          el.removeEventListener(type, fn, opts);
        }
      };
    },

    _applyTransform() {
      if (!this.viewport) return;
      const { scale, tx, ty } = this._view;
      this.viewport.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    },

    /* ---- 悬浮卡片 ---- */
    _buildHoverCard() {
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
      if (world.tone) tags.push(`<span class="tag" style="background:rgba(140,120,200,0.12);color:#5040a0;border-color:rgba(140,120,200,0.22);">${tn[world.tone]||world.tone}</span>`);
      this.hoverCard.innerHTML = `
        <div class="card-title">${escHtml(world.name)}</div>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
        ${world.description ? `<div class="card-desc">${escHtml(world.description)}</div>` : ''}
        <div class="card-stats">
          <span>✦ ${chars.length} 位角色</span>
          <span>✦ ${world.storyCount || 0} 个故事</span>
          ${(world.collaborators && world.collaborators.length > 0) ? `<span>✦ ${world.collaborators.length} 位协作者</span>` : ''}
        </div>
        <div class="card-hint" style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
          <span>点击进入世界 · 星星即角色</span>
          <button class="btn btn-ghost btn-sm btn-icon" title="协作" onclick="event.stopPropagation();showShareModal('${world.$id||world.id}','${escHtml(world.name).replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
        </div>
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

    // 替换原有工具栏
    const oldBar = section.querySelector('.flex.justify-between');
    if (oldBar) {
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

    // 构建星图+网格双容器
    worldsList.innerHTML = `
      <div id="cosmosViewWrap" style="grid-column:1/-1;">
        <div class="cosmos-stage" id="cosmosStage"><div class="cosmos-viewport"></div></div>
      </div>
      <div id="gridViewWrap" style="display:none;grid-column:1/-1;"></div>
    `;

    const stage = document.getElementById('cosmosStage');

    CosmosEngine.viewport = stage.querySelector('.cosmos-viewport');
    CosmosEngine.stage    = stage;

    if (!CosmosEngine.starField) {
      CosmosEngine.starField = new StarField(document.getElementById('cosmos-canvas'));
      CosmosEngine.starField.start();
      CosmosEngine._buildHoverCard();
    }
    // 每次挂载都重新绑定（stage 元素可能已被 DOM 重建）
    CosmosEngine._bindDragZoom();

    if (worlds.length === 0) {
      stage.querySelector('.cosmos-viewport').innerHTML = `
        <div class="cosmos-empty">
          <div class="nebula-ring"><span class="nebula-core">✦</span></div>
          <h3>你的宇宙正在诞生</h3>
          <p>每一个世界观都是一座宇宙，每一位角色都是照亮它的星星</p>
          <div class="cosmos-empty-actions">
            <button class="btn btn-primary" onclick="showCreateWorldModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新建宇宙
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
      wrap.innerHTML = '<p style="color:rgba(50,70,100,0.5);text-align:center;padding:3rem;">暂无世界观</p>';
      return;
    }
    const tl = { fantasy:'奇幻', scifi:'科幻', modern:'现代', historical:'古风', other:'其他' };
    const tn = { dark:'黑暗', light:'温馨', neutral:'中性', mixed:'明暗交织' };
    // 只设置网格布局属性，不覆盖 display
    wrap.style.gridTemplateColumns = 'repeat(auto-fill,minmax(260px,1fr))';
    wrap.style.gap = '1.25rem';
    wrap.innerHTML = worlds.map(w => `
      <div class="card" style="cursor:pointer;" onclick="showWorldDetail('${w.$id||w.id}')">
        <div class="card-cover" style="height:140px;background:rgba(200,215,240,0.45);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--radius-md) var(--radius-md) 0 0;">
          ${w.coverImage
            ? `<img src="${escHtml(w.coverImage)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">`
            : `<span style="font-size:2.5rem;opacity:0.2;">✦</span>`}
        </div>
        <div class="card-body" style="padding:1rem;">
          <h3 style="margin:0 0 0.5rem;">${escHtml(w.name)}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.5rem;">
            ${w.type ? `<span class="badge">${tl[w.type]||w.type}</span>` : ''}
            ${w.tone ? `<span class="badge badge-secondary">${tn[w.tone]||w.tone}</span>` : ''}
          </div>
          ${w.description ? `<p class="text-muted" style="margin:0;font-size:0.8rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(w.description)}</p>` : ''}
          <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.8rem;color:rgba(50,70,100,0.5);">
            <span>${w.characterCount||0} 角色</span>
            <span>${w.storyCount||0} 故事</span>
            ${(w.collaborators && w.collaborators.length > 0) ? `<span>👥 ${w.collaborators.length} 协作者</span>` : ''}
          </div>
        </div>
        <div class="card-footer" style="padding:0.5rem 1rem;border-top:1px solid rgba(120,160,210,0.15);display:flex;justify-content:flex-end;gap:4px;">
          <button class="btn btn-ghost btn-sm btn-icon" title="协作" onclick="event.stopPropagation();showShareModal('${w.$id||w.id}','${escHtml(w.name).replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="编辑" onclick="event.stopPropagation();editWorld('${w.$id||w.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" style="color:rgba(200,70,70,0.7);" title="删除" onclick="event.stopPropagation();deleteWorldConfirm('${w.$id||w.id}','${escHtml(w.name)}')">
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
      // 网格视图提前构建，但保持隐藏
      mountGridView(worlds);
    },

    switchView(view) {
      this.currentView = view;
      const cw = document.getElementById('cosmosViewWrap');
      const gw = document.getElementById('gridViewWrap');
      const bc = document.getElementById('vsw-cosmos');
      const bg = document.getElementById('vsw-grid');

      if (view === 'cosmos') {
        if (cw) cw.style.display = '';
        if (gw) gw.style.display = 'none';
        if (bc) bc.classList.add('active');
        if (bg) bg.classList.remove('active');
      } else {
        if (cw) cw.style.display = 'none';
        if (gw) { gw.style.display = 'grid'; }   // 切换到网格显示
        if (bc) bc.classList.remove('active');
        if (bg) bg.classList.add('active');
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
                新建宇宙
              </button>
            </div>
          </div>
        `;
      }
      // 重建网格视图
      mountGridView(worlds);
      // 如果当前是网格视图，保持显示
      if (this.currentView === 'grid') {
        const gw = document.getElementById('gridViewWrap');
        if (gw) gw.style.display = 'grid';
        const cw = document.getElementById('cosmosViewWrap');
        if (cw) cw.style.display = 'none';
      }
    },
  };

  window.CosmosEngine = CosmosEngine;
  window.CosmosUI     = CosmosUI;

})(window);
