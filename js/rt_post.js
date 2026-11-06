// rt_post.js - classes that subclass transpiled Starling classes, plus patches to transpiled code.
'use strict';

// ---------------------------------------------------------------- PixelMaskDisplayObject (canvas compositing)
class PixelMaskDisplayObject extends DisplayObjectContainer {
  constructor(scaleFactor = -1, isAnimated = true) { super(); this.mIsAnimated = isAnimated; this.mInverted = false; this.mMask = null; }
  get isAnimated() { return this.mIsAnimated; } set isAnimated(v) { this.mIsAnimated = v; }
  get inverted() { return this.mInverted; } set inverted(v) { this.mInverted = v; }
  get mask() { return this.mMask; }
  set mask(v) { this.mMask = v; }
  dispose() { this.mMask = null; super.dispose(); }
  // device-pixel rectangle covered by the mask (mask is not on the display list, so transform manually)
  _maskRect(support, W, H) {
    const t = this.mMask.transformationMatrix.clone(); t.concat(support.m); t.concat(support.view);
    const b = deepBounds(this.mMask, t);
    if (!b) return null;
    let x0 = Math.floor(b[0]) - 2, y0 = Math.floor(b[1]) - 2, x1 = Math.ceil(b[2]) + 2, y1 = Math.ceil(b[3]) + 2;
    if (this.mInverted) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    return (x1 > x0 && y1 > y0) ? [x0, y0, x1 - x0, y1 - y0] : null;
  }
  render(support, alpha) {
    if (!this.mMask || !support.ctx) { super.render(support, alpha); return; }
    const st = Starling.current;
    const target = support.ctx.canvas;
    const R = this._maskRect(support, target.width, target.height);
    if (!R) return;
    const isMain = st && support.ctx === st.ctx;
    const A = isMain ? st.acquireOffscreen() : makeScratch(target);
    const B = isMain ? st.acquireOffscreen() : makeScratch(target);
    for (const o of [A, B]) { o.ctx.save(); o.ctx.beginPath(); o.ctx.rect(R[0], R[1], R[2], R[3]); o.ctx.clip(); }
    const sa = new RenderSupport(A.ctx, support.view); sa.m.copyFrom(support.m); sa.mBlendMode = 'normal';
    super.render(sa, alpha);
    const sb = new RenderSupport(B.ctx, support.view); sb.m.copyFrom(support.m); sb.mBlendMode = 'normal';
    sb.pushMatrix(); sb.transformMatrix(this.mMask); this.mMask.render(sb, 1); sb.popMatrix();
    A.ctx.setTransform(1, 0, 0, 1, 0, 0); A.ctx.globalAlpha = 1; A.ctx.shadowBlur = 0;
    A.ctx.globalCompositeOperation = this.mInverted ? 'destination-out' : 'destination-in';
    A.ctx.drawImage(B.canvas, R[0], R[1], R[2], R[3], R[0], R[1], R[2], R[3]);
    for (const o of [A, B]) o.ctx.restore();
    const ctx = support.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = BLEND_OPS[support.blendMode] || 'source-over'; ctx.shadowBlur = 0;
    ctx.drawImage(A.canvas, R[0], R[1], R[2], R[3], R[0], R[1], R[2], R[3]);
    ctx.restore();
    if (isMain) {
      // leave the pooled canvases clean for the next user (only the touched rect is dirty)
      for (const o of [A, B]) { o.ctx.setTransform(1, 0, 0, 1, 0, 0); o.ctx.globalCompositeOperation = 'source-over'; o.ctx.clearRect(R[0], R[1], R[2], R[3]); st.releaseOffscreen(o); }
    }
  }
}
// bounds of obj's visible content under matrix m (obj's own transform already in m), as [x0,y0,x1,y1].
// Walks children with their real transformationMatrix (DragonBones writes matrices directly).
function deepBounds(obj, m) {
  if (!obj.visible || obj.alpha === 0) return null;
  let pts = null;
  if (obj.mChildren) {
    let r = null;
    for (const c of obj.mChildren) {
      const cm = c.transformationMatrix.clone(); cm.concat(m);
      const b = deepBounds(c, cm);
      if (b) r = r ? [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])] : b;
    }
    if (!(obj instanceof ParticleSystem)) return r;
  }
  const lb = obj.getBounds(obj);
  pts = [[lb.x, lb.y], [lb.right, lb.y], [lb.x, lb.bottom], [lb.right, lb.bottom]];
  const xs = pts.map(([x, y]) => m.a * x + m.c * y + m.tx), ys = pts.map(([x, y]) => m.b * x + m.d * y + m.ty);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function makeScratch(target) {
  const c = document.createElement('canvas'); c.width = target.width; c.height = target.height;
  return { canvas: c, ctx: c.getContext('2d') };
}

// ---------------------------------------------------------------- starling.text.TextField (minimal canvas text)
class TextField extends Sprite {
  constructor(w, h, text = '', font = 'Verdana', size = 12, color = 0, bold = false) {
    super(); this.mWidth = w; this.mHeight = h; this.mText = text; this.mFont = font; this.mSize = size; this.mColor = color; this.mBold = bold;
    this.hAlign = 'center'; this.vAlign = 'center'; this.autoScale = false;
    this._q = new Quad(Math.max(1, w), Math.max(1, h), 0); this._q.alpha = 0; this.addChild(this._q);
  }
  get text() { return this.mText; } set text(v) { this.mText = v; }
  get fontSize() { return this.mSize; } set fontSize(v) { this.mSize = v; }
  get color() { return this.mColor; } set color(v) { this.mColor = v; }
  get fontName() { return this.mFont; } set fontName(v) { this.mFont = v; }
  render(support, alpha) {
    super.render(support, alpha);
    if (!this.mText || !support.ctx) return;
    support._applyTransform(); support._applyState(alpha * this.alpha);
    const ctx = support.ctx; ctx.fillStyle = '#' + (this.mColor & 0xFFFFFF).toString(16).padStart(6, '0');
    ctx.font = (this.mBold ? 'bold ' : '') + this.mSize + 'px "VAG Rounded", "Arial Rounded MT Bold", sans-serif';
    ctx.textAlign = this.hAlign === 'left' ? 'left' : this.hAlign === 'right' ? 'right' : 'center'; ctx.textBaseline = 'middle';
    const x = this.hAlign === 'left' ? 0 : this.hAlign === 'right' ? this.mWidth : this.mWidth / 2;
    ctx.fillText(String(this.mText), x, this.mHeight / 2);
  }
  static registerBitmapFont() { } static getBitmapFont() { return null; }
}


// ---------------------------------------------------------------- Feathers (minimal)
class HorizontalLayout { constructor() { this.gap = 0; this.paddingLeft = this.paddingRight = this.paddingTop = this.paddingBottom = 0; this.verticalAlign = 'top'; this.horizontalAlign = 'left'; } }
class VerticalLayout extends HorizontalLayout { }
class BitmapFontTextFormat { constructor(font, size = NaN, color = 0xFFFFFF, align = 'left') { this.font = font; this.size = size; this.color = color; this.align = align; } }

class Feathers_Button extends Sprite {
  constructor() {
    super(); this._default = null; this._down = null; this._validated = false; this._isDown = false; this._enabled = true;
    this.defaultLabelProperties = {}; this.label = ''; this.isToggle = false;
    this.addEventListener('touch', $fn(this, '_onTouch'));
  }
  get defaultSkin() { return this._default; }
  set defaultSkin(v) { if (this._default) this._default.removeFromParent(); this._default = v; if (v) this.addChildAt(v, 0); this._sync(); }
  get downSkin() { return this._down; }
  set downSkin(v) { if (this._down) this._down.removeFromParent(); this._down = v; if (v) this.addChild(v); this._sync(); }
  get isEnabled() { return this._enabled; } set isEnabled(v) { this._enabled = v; }
  _sync() { if (this._default) this._default.visible = !(this._isDown && this._down); if (this._down) this._down.visible = this._isDown; }
  get width() { return this._validated ? super.width : 0; } set width(v) { super.width = v; }
  get height() { return this._validated ? super.height : 0; } set height(v) { super.height = v; }
  render(support, alpha) { this._validated = true; super.render(support, alpha); }
  _onTouch(e) {
    if (!this._enabled) return;
    const t = e.getTouch(this); if (!t) return;
    if (t.phase === 'began') { this._isDown = true; this._sync(); }
    else if (t.phase === 'moved') {
      const b = this.getBounds(this.stage); const over = b.contains(t.globalX, t.globalY);
      if (over !== this._isDown) { this._isDown = over; this._sync(); }
    } else if (t.phase === 'ended') {
      const was = this._isDown; this._isDown = false; this._sync();
      if (was) this.dispatchEventWith('triggered');
    }
  }
}

class ScrollContainer extends Sprite {
  constructor() {
    super();
    this._w = 0; this._h = 0; this._bg = null; this.layout = null; this.paddingLeft = this.paddingRight = this.paddingTop = this.paddingBottom = 0;
    this.verticalScrollPolicy = 'auto'; this.horizontalScrollPolicy = 'auto';
    this._content = new Sprite(); super.addChild(this._content);
    this._scroll = 0; this._vel = 0; this._drag = null; this._items = [];
    this.addEventListener('touch', $fn(this, '_onTouch'));
    this.addEventListener('enterFrame', $fn(this, '_onFrame'));
  }
  get width() { return this._w; } set width(v) { this._w = v; this._relayout(); }
  get height() { return this._h; } set height(v) { this._h = v; this._relayout(); }
  get backgroundSkin() { return this._bg; }
  set backgroundSkin(v) { if (this._bg) this._bg.removeFromParent(); this._bg = v; if (v) super.addChildAt(v, 0); this._relayout(); }
  get horizontalScrollPosition() { return this._scroll; } set horizontalScrollPosition(v) { this._scroll = v; this._apply(); }
  get maxHorizontalScrollPosition() { return Math.max(0, this._contentW - (this._w - this.paddingLeft - this.paddingRight)); }
  addChild(c) { this._items.push(c); this._content.addChild(c); this._relayout(); return c; }
  addChildAt(c, i) { if (!this._items) return super.addChildAt(c, i); this._items.splice(i, 0, c); this._content.addChildAt(c, Math.min(i, this._content.numChildren)); this._relayout(); return c; }
  removeChild(c, d = false) { const i = this._items.indexOf(c); if (i >= 0) { this._items.splice(i, 1); this._content.removeChild(c, d); this._relayout(); return c; } return super.removeChild(c, d); }
  get numChildren() { return this._items ? this._items.length : super.numChildren; }
  getChildAt(i) { return this._items[i]; }
  _relayout() {
    if (!this._items) return;
    if (this._bg) { this._bg.width = this._w || this._bg.width; this._bg.height = this._h || this._bg.height; }
    // same rules as feathers.layout.HorizontalLayout.layout(): items are positioned by x/y directly
    // (pivots are not compensated), vertical placement follows verticalAlign.
    const L = this.layout || new HorizontalLayout();
    const viewH = (this._h || 0) - this.paddingTop - this.paddingBottom;
    let x = L.paddingLeft, maxH = 0;
    for (const it of this._items) { it.x = x; x += it.width + L.gap; maxH = Math.max(maxH, it.height); }
    const H = viewH > 0 ? viewH : maxH + L.paddingTop + L.paddingBottom;
    for (const it of this._items) {
      if (L.verticalAlign === 'bottom') it.y = H - L.paddingBottom - it.height;
      else if (L.verticalAlign === 'middle') it.y = L.paddingTop + (H - L.paddingTop - L.paddingBottom - it.height) / 2;
      else it.y = L.paddingTop;
    }
    this._contentW = x - L.gap + L.paddingRight;
    this._content.x = this.paddingLeft; this._content.y = this.paddingTop;
    this._apply();
  }
  _apply() { const m = this.maxHorizontalScrollPosition; this._scroll = Math.max(0, Math.min(m, this._scroll)); this._content.x = this.paddingLeft - this._scroll; }
  _onTouch(e) {
    const t = e.getTouch(this); if (!t) return;
    if (t.phase === 'began') { this._drag = { x: t.globalX, s: this._scroll, last: t.globalX, moved: false }; this._vel = 0; }
    else if (t.phase === 'moved' && this._drag) {
      const sc = this.parent ? this.getTransformationMatrix(this.stage).a : 1;
      const dx = (t.globalX - this._drag.x) / (sc || 1);
      if (Math.abs(dx) > 8) this._drag.moved = true;
      if (this._drag.moved) { this._vel = (t.globalX - this._drag.last) / (sc || 1); this._scroll = this._drag.s - dx; this._apply(); }
      this._drag.last = t.globalX;
    } else if (t.phase === 'ended') { this._drag = null; }
  }
  _onFrame() { if (!this._drag && Math.abs(this._vel) > 0.3) { this._scroll -= this._vel; this._vel *= 0.92; this._apply(); } }
  hitTest(p, forTouch = false) {
    if (forTouch && (!this.visible || !this.touchable)) return null;
    if (p.x < 0 || p.y < 0 || p.x > this._w || p.y > this._h) return null;
    return super.hitTest(p, forTouch) || this;
  }
  getBounds(target, out = null) {
    out = out || new Rectangle();
    const m = this.getTransformationMatrix(target);
    const pts = [[0, 0], [this._w, 0], [0, this._h], [this._w, this._h]].map(([x, y]) => [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    out.setTo(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return out;
  }
  render(support, alpha) {
    const ctx = support.ctx;
    if (!ctx) { super.render(support, alpha); return; }
    if (this._bg && this._bg.hasVisibleArea) { support.pushMatrix(); support.transformMatrix(this._bg); this._bg.render(support, alpha * this.alpha); support.popMatrix(); }
    ctx.save();
    support._applyTransform();
    ctx.beginPath(); ctx.rect(0, 0, this._w, this._h); ctx.clip();
    support.pushMatrix(); support.transformMatrix(this._content); this._content.render(support, alpha * this.alpha); support.popMatrix();
    ctx.restore();
  }
}
class Slider extends Sprite { constructor() { super(); this.minimum = 0; this.maximum = 1; this.value = 0; this.step = 0; this.direction = 'horizontal'; } }

// ---------------------------------------------------------------- platform stand-ins
class WubbzysBeautySalon { }
WubbzysBeautySalon.savedVariablesObject = null;
// ---- Parent-area screens (native Flash overlays in the AIR app, HTML overlays here)
// An overlay layer sized in stage coordinates (1366x768) that tracks the canvas.
const Overlay = {
  el: null, inner: null,
  ensure() {
    if (this.el) return this.inner;
    const el = document.createElement('div'); el.className = 'wbz-overlay';
    const inner = document.createElement('div'); inner.className = 'wbz-overlay-inner';
    el.appendChild(inner); document.body.appendChild(el);
    this.el = el; this.inner = inner; this.fit(); window.addEventListener('resize', () => this.fit());
    return inner;
  },
  fit() {
    if (!this.el || !Starling.current) return;
    const c = Starling.current.canvas.getBoundingClientRect(), st = Starling.current;
    Object.assign(this.el.style, { left: c.left + 'px', top: c.top + 'px', width: c.width + 'px', height: c.height + 'px' });
    const s = c.width / st.visW;
    this.inner.style.transform = 'translate(' + (-st.cropX * s) + 'px,0) scale(' + s + ')';
  },
  clear() { if (this.inner) this.inner.innerHTML = ''; if (this.el) this.el.style.display = 'none'; },
  show() { this.ensure(); this.el.style.display = 'block'; return this.inner; }
};
function hotspot(parent, x, y, w, h, title, fn) {
  const b = document.createElement('button'); b.className = 'wbz-hot'; b.title = title; b.setAttribute('aria-label', title);
  Object.assign(b.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  parent.appendChild(b); return b;
}
const ASSETS = () => (window.ASSET_BASE || 'assets/');

// utils.Captcha: "provide your year of birth" gate (age >= 14), same rules as the original
const Captcha = {
  Show(callback) {
    const root = Overlay.show(); root.innerHTML = '';
    const shade = document.createElement('div'); shade.className = 'wbz-shade'; shade.style.opacity = '0.25'; root.appendChild(shade);
    const box = document.createElement('div'); box.className = 'wbz-abs';
    Object.assign(box.style, { left: (171 + 512 - 793 / 2) + 'px', top: (384 - 411 / 2) + 'px', width: '793px', height: '411px', background: 'url(' + ASSETS() + 'MoreApps/captcha/captcha1x.png)' });
    root.appendChild(box);
    const tf = document.createElement('input'); tf.className = 'wbz-year'; tf.inputMode = 'numeric'; tf.maxLength = 4; tf.autocomplete = 'off';
    Object.assign(tf.style, { left: '296px', top: '260px', width: '200px', height: '50px' });
    tf.addEventListener('input', () => { tf.value = tf.value.replace(/[^0-9]/g, ''); });
    box.appendChild(tf);
    const done = (ok, closed) => { Overlay.clear(); callback(ok, closed); };
    const okTap = () => { const y = Number(tf.value), now = new Date().getFullYear(); done(!isNaN(y) && y > 1897 && now - y >= 14 && now - y < 125, false); };
    tf.addEventListener('keydown', (e) => { if (e.key === 'Enter') okTap(); });
    hotspot(box, 668, 0, 97, 95, 'Close', () => done(false, true));
    hotspot(box, 300, 324, 194, 86, 'OK', okTap);
    setTimeout(() => tf.focus(), 50);
  }
};

// utils.ForParentsScreen: Cupcake Digital's parents page (scrolling image with tap areas)
class ForParentsScreen {
  static Show(container, parent) { ForParentsScreen.PARENT = parent; Captcha.Show(ForParentsScreen.CaptchaReturn); }
  static CaptchaReturn(ok, closed) {
    if (ok) ForParentsScreen.open();
    else { Starling.current.start(); if (ForParentsScreen.PARENT) ForParentsScreen.PARENT.enableButtons(); }
  }
  static open() {
    const root = Overlay.show(); root.innerHTML = '';
    const shade = document.createElement('div'); shade.className = 'wbz-shade'; root.appendChild(shade);
    const scroller = document.createElement('div'); scroller.className = 'wbz-fp-scroll'; root.appendChild(scroller);
    const page = document.createElement('div'); page.className = 'wbz-fp-page';
    page.style.background = 'url(' + ASSETS() + 'MoreApps/forparents/ForParents.jpg)'; scroller.appendChild(page);
    const L = (u) => () => navigateToURL(new URLRequest(u));
    const R = (x, y, w, h, t, f) => hotspot(page, x, y, w, h, t, f);
    R(480, 2, 421, 106, 'Cupcake Digital', L('http://www.cupcakedigital.com/'));
    R(202, 1035, 328, 138, 'CupcakeDigital.com', L('http://www.cupcakedigital.com/'));
    R(1122, 2, 76, 78, 'Close', ForParentsScreen.Hide);
    R(290, 142, 780, 254, 'Subscribe to the newsletter', L('http://www.cupcakedigital.com/mobilenewsletter.php?app=' + ForParentsScreen.appCode + '&market=' + Market.market));
    R(698, 632, 480, 180, 'Activities', L('http://www.cupcakedigital.com/parentsguide/worksheets-and-activities/'));
    R(202, 434, 481, 153, 'More Apps', () => MoreApps.openSite());
    R(698, 431, 481, 153, 'Rate us', () => Market.Open());
    R(202, 632, 481, 153, 'Help', () => { ForParentsScreen.Hide(); if (ForParentsScreen.PARENT) ForParentsScreen.PARENT.showHelpPage(); });
    R(698, 984, 440, 70, 'Privacy Policy', L('http://www.cupcakedigital.com/appsprivacy'));
    R(674, 879, 76, 78, 'Facebook', L('https://www.facebook.com/cupcakedigital'));
    R(565, 879, 76, 78, 'Twitter', L('https://twitter.com/cupcake_digital'));
    R(780, 879, 76, 78, 'Pinterest', L('http://pinterest.com/cupcakedigital/'));
    R(882, 879, 76, 78, 'LinkedIn', L('http://www.linkedin.com/company/2690908?trk=tyah'));
    R(988, 879, 76, 78, 'Instagram', L('http://instagram.com/cupcakedigital'));
  }
  static Hide() {
    Overlay.clear(); Starling.current.stage3D.visible = true; Starling.current.start();
    if (ForParentsScreen.PARENT) ForParentsScreen.PARENT.enableButtons();
  }
}
ForParentsScreen.appCode = 'WBZ_Beauty';

// utils.MoreApps: the remote app list (cupcake.s3.amazonaws.com) no longer exists, so the
// Apps button goes where the More Apps screen's Cupcake Digital logo went.
class MoreApps {
  static Setup(cb, lang) { MoreApps.moreAppsLoaded = true; MoreApps.apps = [{ id: '', fileName: '', altFile: '' }]; setTimeout(() => cb && cb(), 0); }
  static openSite() { navigateToURL(new URLRequest('http://cupcakedigital.com/')); }
  static Show(container) { MoreApps.openSite(); Starling.current.start(); }
  static Hide() { }
}
MoreApps.moreAppsLoaded = false; MoreApps.apps = [];

// utils.Market: store page for this app (Android build = Google Play)
class Market {
  static Open(id = '') {
    id = id || Market.ids[Market.market];
    const url = Market.market === 'amazon' ? 'http://www.amazon.com/gp/mas/dl/android?p=' + id
      : Market.market === 'itunes' ? 'itms-apps://itunes.com/apps/' + id : 'market://details?id=' + id;
    navigateToURL(new URLRequest(url));
  }
}
Market.market = 'google';
Market.ids = { itunes: 'wubbzysbeautysalon', amazon: 'air.com.cupcakedigital.wbz.beauty', google: 'air.com.cupcakedigital.wbz.beauty', nook: '', none: 'null' };

// Embedded SWF bitmaps
function __embeddedBitmapClass(key) {
  return class { constructor() { const img = EMBEDDED[key]; const bd = new BitmapData(img.naturalWidth, img.naturalHeight, true, 0); bd.ctx.drawImage(img, 0, 0); return new Bitmap(bd); } };
}
const EMBEDDED = {};
const load_1_png = __embeddedBitmapClass('load_1');
const load_2_png = __embeddedBitmapClass('load_2');
const splash_png = __embeddedBitmapClass('splash');

// AIR StageVideo player -> HTML <video> overlay
class AIRMobileVideo {
  constructor(stage, onDone = null) { this.onDone = onDone; this.el = null; }
  playVideo(path, width) {
    this.destroyEl();
    const v = document.createElement('video');
    v.src = (window.ASSET_BASE || 'assets/') + path.replace(/\.flv$/i, '.mp4');
    v.playsInline = true; v.setAttribute('playsinline', ''); v.autoplay = true; v.className = 'wbz-video';
    const finish = () => { if (!this.el) return; this.destroyEl(); if (this.onDone) this.onDone(); };
    v.onended = finish; v.onerror = finish;
    v.addEventListener('pointerdown', finish);
    document.body.appendChild(v); this.el = v;
    const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(finish); });
  }
  destroyEl() { if (this.el) { this.el.pause(); this.el.remove(); this.el = null; } }
  stopVideo() { this.destroyEl(); } pauseVideo() { if (this.el) this.el.pause(); } resumeVideo() { if (this.el) this.el.play(); }
  setVolume() { } onMetaData() { }
  destroy() { this.destroyEl(); }
}

// ---------------------------------------------------------------- patches to transpiled Starling / game classes
TouchProcessor.prototype.monitorInterruptions = function () { };
Stage.prototype.drawToBitmapData = function () { return new BitmapData(1, 1); };

// Particle rendering on canvas (simulation stays in the original ParticleSystem code)
ParticleSystem.prototype.render = function (support, parentAlpha) {
  const n = this.mNumParticles; if (!n || !support.ctx) return;
  const tex = this.mTexture; const root = tex && tex.root; if (!root || !root.source) return;
  if (!this._pvd) { this._pvd = new VertexData(4); this._pvd.setTexCoords(0, 0, 0); this._pvd.setTexCoords(3, 1, 1); tex.adjustTexCoords(this._pvd.mRawData, 6, 6, 4); }
  const raw = this._pvd.mRawData; const W = root.sourceWidth, H = root.sourceHeight;
  const sx = raw[6] * W, sy = raw[7] * H, sw = (raw[30] - raw[6]) * W, sh = (raw[31] - raw[7]) * H;
  const src = this.mBlendFactorSource, dst = this.mBlendFactorDestination;
  const blend = (dst === 'one') ? 'lighter' : (BLEND_OPS[support.blendMode] || 'source-over');
  const a0 = parentAlpha * this.alpha; const tw = tex.width, th = tex.height;
  for (let i = 0; i < n; i++) {
    const p = this.mParticles[i];
    const a = a0 * p.alpha; if (a <= 0.004) continue;
    const s = p.scale; if (s <= 0) continue;
    let img = root.source, isx = sx, isy = sy, isw = sw, ish = sh;
    const col = p.color & 0xFFFFFF;
    if (col !== 0xFFFFFF) {
      const q = ((col >> 16 & 0xF8) << 16) | ((col >> 8 & 0xF8) << 8) | (col & 0xF8);
      img = tintedSource(root.source, sx, sy, sw, sh, q); isx = 0; isy = 0; isw = img.width; ish = img.height;
    }
    support.drawImageAt(img, isx, isy, isw, ish, p.x, p.y, tw * s, th * s, p.rotation, a, blend);
  }
};

// Pixel-precise hit test via texture alpha (falls back to bounds if pixels are unreadable)
if (typeof ImageADV !== 'undefined') {
  ImageADV.prototype.hitTest = function (p, forTouch = false) {
    if (forTouch && (!this.visible || !this.touchable)) return null;
    if (!this.getBounds(this).containsPoint(p)) return null;
    const vd = new VertexData(4); this.copyVertexDataTo(vd, 0); const r = vd.mRawData;
    const root = this.texture.root; const x0 = r[0], y0 = r[1], x3 = r[24], y3 = r[25];
    const u = r[6] + (r[30] - r[6]) * (p.x - x0) / (x3 - x0), v = r[7] + (r[31] - r[7]) * (p.y - y0) / (y3 - y0);
    const a = root.alphaAt ? root.alphaAt(u * root.sourceWidth, v * root.sourceHeight) : -1;
    return (a < 0 || a > 10) ? this : null;
  };
}

// Sprite.flatten() is a Stage3D batching optimisation; on canvas we simply keep rendering normally.
Sprite.prototype.flatten = function () { };
Sprite.prototype.unflatten = function () { };
Object.defineProperty(Sprite.prototype, 'isFlattened', { get() { return false; }, configurable: true });

// The menu's "sparkly" featured-app button needs a downloaded app icon; there is no feed any more.
Menu.prototype.loadSparklyAppButton = function () { };
