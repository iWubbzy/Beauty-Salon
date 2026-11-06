// rt_starling.js - Canvas2D replacement for the GPU-facing parts of Starling 1.4
// (core loop, RenderSupport, textures, render textures, masks, filters, assets, sound).
'use strict';

const STAGE_W = 1366, STAGE_H = 768;

// ---------------------------------------------------------------- fake Stage3D context
const FAKE_BUFFER = { uploadFromVector() { }, dispose() { } };
const FAKE_CONTEXT = {
  driverInfo: 'Canvas2D', createVertexBuffer() { return FAKE_BUFFER; }, createIndexBuffer() { return FAKE_BUFFER; },
  createProgram() { return { upload() { }, dispose() { } }; }, setBlendFactors() { }, setTextureAt() { }, setProgram() { },
  setProgramConstantsFromMatrix() { }, setProgramConstantsFromVector() { }, setVertexBufferAt() { }, drawTriangles() { },
  drawToBitmapData() { }, present() { }, clear() { }, setScissorRectangle() { }, setRenderToBackBuffer() { }, setRenderToTexture() { }
};
class AGALMiniAssembler { assemble() { this.agalcode = new ByteArray(); return this.agalcode; } }
class TouchMarker { constructor() { this.visible = false; } dispose() { } moveMarker() { } removeFromParent() { } }
class QuadBatch { constructor() { } dispose() { } reset() { } }
const TextureSmoothing = { NONE: 'none', BILINEAR: 'bilinear', TRILINEAR: 'trilinear', isValid() { return true; } };

// ---------------------------------------------------------------- tint cache
const __tintCache = new WeakMap();
function tintedSource(src, sx, sy, sw, sh, color) {
  let per = __tintCache.get(src);
  if (!per) { per = new Map(); __tintCache.set(src, per); }
  const key = sx + ',' + sy + ',' + sw + ',' + sh + ',' + color;
  let c = per.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(sw)); c.height = Math.max(1, Math.ceil(sh));
  const g = c.getContext('2d');
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0');
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  if (per.size > 400) per.clear();
  per.set(key, c);
  return c;
}

const BLEND_OPS = { normal: 'source-over', auto: 'source-over', none: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen', erase: 'destination-out', below: 'destination-over' };

// ---------------------------------------------------------------- RenderSupport
class RenderSupport {
  constructor(ctx, view) {
    this.ctx = ctx || null;
    this.view = view || new Matrix();
    this.m = new Matrix();
    this.stack = []; this.depth = 0;
    this.mBlendMode = 'normal';
    this.glow = null;
    this.mvpMatrix3D = new Matrix3D();
    this._tmp = new Matrix();
    this._vd = null;
  }
  static transformMatrixForObject(m, obj) { const t = obj.transformationMatrix.clone(); t.concat(m); m.copyFrom(t); }
  static setBlendFactors() { }
  static getTextureLookupFlags() { return ''; }
  get blendMode() { return this.mBlendMode; }
  set blendMode(v) { if (v !== 'auto') this.mBlendMode = v; }
  get modelViewMatrix() { return this.m; }
  nextFrame() { } finishQuadBatch() { } raiseDrawCount() { } setOrthographicProjection() { } loadIdentity() { this.m.identity(); }
  clear() { }
  pushMatrix() {
    let s = this.stack[this.depth];
    if (!s) { s = new Matrix(); this.stack[this.depth] = s; }
    s.copyFrom(this.m); this.depth++;
  }
  popMatrix() { this.depth--; this.m.copyFrom(this.stack[this.depth]); }
  transformMatrix(obj) { this.prependMatrix(obj.transformationMatrix); }
  prependMatrix(t) {
    const m = this.m;
    const a = t.a * m.a + t.b * m.c, b = t.a * m.b + t.b * m.d;
    const c = t.c * m.a + t.d * m.c, d = t.c * m.b + t.d * m.d;
    const tx = t.tx * m.a + t.ty * m.c + m.tx, ty = t.tx * m.b + t.ty * m.d + m.ty;
    m.a = a; m.b = b; m.c = c; m.d = d; m.tx = tx; m.ty = ty;
  }
  _applyTransform() {
    const m = this.m, v = this.view, ctx = this.ctx;
    ctx.setTransform(m.a * v.a + m.b * v.c, m.a * v.b + m.b * v.d, m.c * v.a + m.d * v.c, m.c * v.b + m.d * v.d,
      m.tx * v.a + m.ty * v.c + v.tx, m.tx * v.b + m.ty * v.d + v.ty);
  }
  _applyState(alpha) {
    const ctx = this.ctx;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = BLEND_OPS[this.mBlendMode] || 'source-over';
    if (this.glow) { ctx.shadowColor = this.glow.css; ctx.shadowBlur = this.glow.blur * Math.abs(this.view.a) * 4; }
    else if (ctx.shadowBlur) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
  }
  batchQuad(quad, parentAlpha, texture = null, smoothing = null) {
    const ctx = this.ctx; if (!ctx) return;
    let raw;
    if (texture) {
      if (!this._vd) this._vd = new VertexData(4);
      quad.copyVertexDataTo(this._vd, 0);
      raw = this._vd.mRawData;
    } else raw = quad.mVertexData.mRawData;
    const alpha = parentAlpha * quad.alpha * raw[5];
    if (alpha <= 0.001) return;
    this._applyTransform();
    this._applyState(alpha);
    const x0 = raw[0], y0 = raw[1], x3 = raw[24], y3 = raw[25];
    const r = raw[2], g = raw[3], b = raw[4];
    if (!texture) {
      const r2 = raw[18], g2 = raw[19], b2 = raw[20];
      if (r2 !== r || g2 !== g || b2 !== b) {
        const gr = ctx.createLinearGradient(0, y0, 0, y3);
        gr.addColorStop(0, rgbCss(r, g, b)); gr.addColorStop(1, rgbCss(r2, g2, b2)); ctx.fillStyle = gr;
      } else ctx.fillStyle = rgbCss(r, g, b);
      ctx.fillRect(x0, y0, x3 - x0, y3 - y0);
      return;
    }
    const root = texture.root; const src = root && root.source;
    if (!src || !root.loaded) return;
    const W = root.sourceWidth, H = root.sourceHeight;
    let u0 = raw[6], v0 = raw[7], u3 = raw[30], v3 = raw[31];
    let dx = x0, dy = y0, dw = x3 - x0, dh = y3 - y0;
    let flipX = false, flipY = false;
    if (u3 < u0) { const t = u0; u0 = u3; u3 = t; flipX = true; }
    if (v3 < v0) { const t = v0; v0 = v3; v3 = t; flipY = true; }
    let sx = u0 * W, sy = v0 * H, sw = (u3 - u0) * W, sh = (v3 - v0) * H;
    if (sw <= 0 || sh <= 0 || dw === 0 || dh === 0) return;
    // clamp to source bounds (repeat textures are not used by this game)
    if (sx < 0) { dx -= sx * dw / sw; dw += sx * dw / sw; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy * dh / sh; dh += sy * dh / sh; sh += sy; sy = 0; }
    if (sx + sw > W) { const o = sx + sw - W; dw -= o * dw / sw; sw -= o; }
    if (sy + sh > H) { const o = sy + sh - H; dh -= o * dh / sh; sh -= o; }
    if (sw <= 0 || sh <= 0) return;
    ctx.imageSmoothingEnabled = smoothing !== 'none';
    let img = src, isx = sx, isy = sy, isw = sw, ish = sh;
    if (r < 0.999 || g < 0.999 || b < 0.999) {
      const col = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      img = tintedSource(src, sx, sy, sw, sh, col); isx = 0; isy = 0; isw = img.width; ish = img.height;
    }
    if (flipX || flipY) {
      ctx.translate(dx + (flipX ? dw : 0), dy + (flipY ? dh : 0)); ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, isx, isy, isw, ish, 0, 0, dw, dh);
    } else ctx.drawImage(img, isx, isy, isw, ish, dx, dy, dw, dh);
  }
  // draw an arbitrary canvas image (used by particles)
  drawImageAt(img, sx, sy, sw, sh, cx, cy, w, h, rot, alpha, blend) {
    const ctx = this.ctx; if (!ctx) return;
    this._applyTransform();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = blend;
    ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  }
}
function rgbCss(r, g, b) { return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')'; }

// ---------------------------------------------------------------- Textures
class Texture {
  constructor() { }
  dispose() { }
  adjustVertexData(vd, idx, count) { }
  adjustTexCoords(data, start = 0, stride = 0, count = -1) { }
  get frame() { return null; }
  get repeat() { return false; }
  get width() { return 0; } get height() { return 0; }
  get nativeWidth() { return 0; } get nativeHeight() { return 0; }
  get scale() { return 1; }
  get base() { return this.root; }
  get root() { return null; }
  get format() { return 'bgra'; }
  get mipMapping() { return false; }
  get premultipliedAlpha() { return false; }
  static fromBitmap(bmp) { return Texture.fromBitmapData(bmp.bitmapData); }
  static fromBitmapData(bd) { return new ConcreteTexture(bd.canvas || bd.image || bd); }
  static fromEmbeddedAsset(cls) { const b = new cls(); return Texture.fromBitmap(b); }
  static fromImage(img) { return new ConcreteTexture(img); }
  static fromColor(w, h, color = 0xFFFFFFFF) {
    const bd = new BitmapData(w, h, true, color); return new ConcreteTexture(bd.canvas);
  }
  static empty(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return new ConcreteTexture(c); }
  static fromTexture(tex, region = null, frame = null, rotated = false) { return new SubTexture(tex, region, false, frame, rotated); }
}
class ConcreteTexture extends Texture {
  constructor(source, w, h) {
    super();
    this.source = source;
    this.sourceWidth = w || source.naturalWidth || source.width;
    this.sourceHeight = h || source.naturalHeight || source.height;
    this.loaded = true;
    this._alpha = null;
  }
  get width() { return this.sourceWidth; } get height() { return this.sourceHeight; }
  get nativeWidth() { return this.sourceWidth; } get nativeHeight() { return this.sourceHeight; }
  get root() { return this; }
  get base() { return this; }
  dispose() { }
  // alpha lookup for pixel-precise hit tests; returns -1 if pixels are unreadable
  alphaAt(x, y) {
    try {
      if (!this._alpha) {
        const c = document.createElement('canvas'); c.width = this.sourceWidth; c.height = this.sourceHeight;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(this.source, 0, 0);
        this._alpha = g.getImageData(0, 0, c.width, c.height).data;
      }
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.sourceWidth || y >= this.sourceHeight) return 0;
      return this._alpha[(y * this.sourceWidth + x) * 4 + 3];
    } catch (e) { return -1; }
  }
}
class RenderTexture extends ConcreteTexture {
  constructor(w, h, persistent = true, scale = -1) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    super(c, c.width, c.height);
    this.ctx = c.getContext('2d');
    this.mIsPersistent = persistent;
    this._support = new RenderSupport(this.ctx, new Matrix());
  }
  get isPersistent() { return this.mIsPersistent; }
  draw(obj, matrix = null, alpha = 1, antiAliasing = 0) {
    if (!obj) return;
    const s = this._support;
    s.depth = 0; s.m.identity(); s.mBlendMode = 'normal'; s.glow = null;
    s.blendMode = obj.blendMode;
    if (matrix) s.prependMatrix(matrix); else s.transformMatrix(obj);
    this.ctx.save();
    if (obj.filter && obj.filter.render) obj.filter.render(obj, s, alpha);
    else obj.render(s, alpha);
    this.ctx.restore();
  }
  drawBundled(fn) { fn(); }
  clear(color = 0, alpha = 0) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.globalCompositeOperation = 'source-over'; this.ctx.globalAlpha = 1;
    this.ctx.clearRect(0, 0, this.source.width, this.source.height);
    if (alpha > 0) { this.ctx.globalAlpha = alpha; this.ctx.fillStyle = '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0'); this.ctx.fillRect(0, 0, this.source.width, this.source.height); this.ctx.globalAlpha = 1; }
  }
  dispose() { }
}

// ---------------------------------------------------------------- filters
class FragmentFilter { constructor() { } dispose() { } render(obj, support, alpha) { obj.render(support, alpha); } }
class BlurFilter extends FragmentFilter {
  constructor(bx = 1, by = 1, res = 1) { super(); this.blurX = bx; this.blurY = by; this.glow = null; }
  static createGlow(color = 0xFFFF00, alpha = 1, blur = 1, res = 0.5) {
    const f = new BlurFilter(blur, blur, res);
    f.glow = { css: 'rgba(' + ((color >> 16) & 255) + ',' + ((color >> 8) & 255) + ',' + (color & 255) + ',' + alpha + ')', blur: blur };
    return f;
  }
  static createDropShadow(dist = 4, angle = 0.785, color = 0, alpha = 0.5, blur = 1) { return BlurFilter.createGlow(color, alpha, blur); }
  setUniformColor() { }
  render(obj, support, alpha) {
    const prev = support.glow; support.glow = this.glow || prev;
    obj.render(support, alpha);
    support.glow = prev;
    if (support.ctx) { support.ctx.shadowBlur = 0; support.ctx.shadowColor = 'transparent'; }
  }
}
class WarpFilter extends FragmentFilter { }
class ColorMatrixFilter extends FragmentFilter { }

// ---------------------------------------------------------------- Starling core
class Starling extends Flash_EventDispatcher {
  constructor(rootClass, canvas) {
    super();
    Starling.current = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = new Matrix();
    this.support = new RenderSupport(this.ctx, this.view);
    this.juggler = new Juggler();
    this.stage = new Stage(STAGE_W, STAGE_H, 0x000000);
    this.touchProcessor = new TouchProcessor(this.stage);
    this.nativeStage = Object.assign(new Flash_EventDispatcher(), { fullScreenWidth: STAGE_W, fullScreenHeight: STAGE_H, stageWidth: STAGE_W, stageHeight: STAGE_H, quality: 'high', frameRate: 60 });
    this.nativeOverlay = new Flash_Sprite();
    this.stage3D = { visible: true, addEventListener() { }, removeEventListener() { } };
    this.context = FAKE_CONTEXT;
    this.contentScaleFactor = 1;
    this.viewPort = new Rectangle(0, 0, STAGE_W, STAGE_H);
    this.started = true;
    this.offscreen = [];
    this.mRoot = new rootClass();
    this.stage.addChildAt(this.mRoot, 0);
    this._last = performance.now();
    this._frame = this._frame.bind(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._bindInput();
    requestAnimationFrame(this._frame);
  }
  static get juggler() { return Starling.current ? Starling.current.juggler : null; }
  static get context() { return FAKE_CONTEXT; }
  get root() { return this.mRoot; }
  get isStarted() { return this.started; }
  start() { this.started = true; }
  stop() { this.started = false; }
  getProgram() { return {}; } registerProgram() { } hasProgram() { return true; } deleteProgram() { }
  get contextData() { return this._cd || (this._cd = {}); }
  // Visible part of the 1366x768 stage for the current window, like the AIR app's "noBorder"
  // viewport: narrower screens crop the sides (down to the 4:3 iPad area, 1024 wide),
  // wider-than-16:9 windows get side bars instead of losing the top and bottom.
  static visibleStageWidth() {
    if (Starling.fixedVisW) return Starling.fixedVisW;   // framing is chosen once, at start-up
    const a = window.innerWidth / Math.max(1, window.innerHeight);
    return Math.round(Math.max(1024, Math.min(STAGE_W, STAGE_H * a)));
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ww = window.innerWidth, wh = window.innerHeight;
    const visW = Starling.visibleStageWidth();
    this.visW = visW; this.cropX = (STAGE_W - visW) / 2;
    const s = Math.min(ww / visW, wh / STAGE_H);
    const cw = Math.round(visW * s), ch = Math.round(STAGE_H * s);
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    this.canvas.style.left = Math.round((ww - cw) / 2) + 'px'; this.canvas.style.top = Math.round((wh - ch) / 2) + 'px';
    this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr);
    const k = this.canvas.width / visW;
    this.view.setTo(k, 0, 0, this.canvas.height / STAGE_H, -this.cropX * k, 0);
    this.cssScale = s;
    this.offscreen = [];
  }
  // stage coordinates -> page coordinates (used by tests)
  stageToClient(x, y) { const r = this.canvas.getBoundingClientRect(); return [r.left + (x - this.cropX) / this.visW * r.width, r.top + y / STAGE_H * r.height]; }
  // pooled offscreen canvases matching the main canvas (for pixel masks)
  acquireOffscreen() {
    let o = this.offscreen.find(x => !x.busy);
    if (!o) { const c = document.createElement('canvas'); o = { canvas: c, ctx: c.getContext('2d'), busy: false }; this.offscreen.push(o); }
    if (o.canvas.width !== this.canvas.width || o.canvas.height !== this.canvas.height) { o.canvas.width = this.canvas.width; o.canvas.height = this.canvas.height; o.fresh = undefined; }
    o.busy = true; o.ctx.setTransform(1, 0, 0, 1, 0, 0); o.ctx.globalCompositeOperation = 'source-over'; o.ctx.globalAlpha = 1;
    if (o.fresh === undefined) { o.ctx.clearRect(0, 0, o.canvas.width, o.canvas.height); o.fresh = false; }
    return o;
  }
  releaseOffscreen(o) { o.busy = false; }
  _bindInput() {
    const c = this.canvas; const tp = this.touchProcessor;
    const toStage = (e) => { const r = c.getBoundingClientRect(); return [this.cropX + (e.clientX - r.left) / r.width * this.visW, (e.clientY - r.top) / r.height * STAGE_H]; };
    const down = new Set();
    c.addEventListener('pointerdown', e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) { } down.add(e.pointerId); const [x, y] = toStage(e); tp.enqueue(e.pointerId, 'began', x, y); });
    c.addEventListener('pointermove', e => { const [x, y] = toStage(e); if (down.has(e.pointerId)) tp.enqueue(e.pointerId, 'moved', x, y); else if (e.pointerType === 'mouse') tp.enqueue(e.pointerId, 'hover', x, y); });
    const up = e => { if (!down.has(e.pointerId)) return; down.delete(e.pointerId); const [x, y] = toStage(e); tp.enqueue(e.pointerId, 'ended', x, y); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', e => e.preventDefault());
  }
  _frame(now) {
    requestAnimationFrame(this._frame);
    let dt = (now - this._last) / 1000; this._last = now;
    if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;
    if (!this.started) return;
    try {
      this.touchProcessor.advanceTime(dt);
      this.stage.advanceTime(dt);
      this.juggler.advanceTime(dt);
      TweenMax._tick(dt);
    } catch (e) { console.error(e); }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.support; s.depth = 0; s.m.identity(); s.mBlendMode = 'normal'; s.glow = null;
    try { this.stage.render(s, 1); } catch (e) { console.error(e); }
    if (window.WBZ_onFrame) window.WBZ_onFrame();
  }
}
Starling.handleLostContext = false;
Starling.multitouchEnabled = true;
Starling.VERSION = '1.4-canvas';

// ---------------------------------------------------------------- Sound (Web Audio with HTMLAudio fallback)
const AudioSys = {
  ctx: null, master: null, muted: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; } }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
};
class Sound extends Flash_EventDispatcher {
  constructor(buffer, url) { super(); this.buffer = buffer || null; this.url = url || null; }
  get length() { return this.buffer ? this.buffer.duration * 1000 : (this._dur || 0) * 1000; }
  play(startTime = 0, loops = 0, st = null) {
    const ch = new SoundChannel(this, startTime / 1000, loops, st);
    return ch;
  }
  close() { }
}
class SoundChannel extends Flash_EventDispatcher {
  constructor(sound, offset, loops, st) {
    super();
    if (!sound) return;
    this.sound = sound; this._st = st || new SoundTransform(); this._stopped = false; this._t0 = 0;
    const plays = Math.max(1, loops | 0);
    if (sound.buffer && AudioSys.ctx) {
      const ac = AudioSys.ctx;
      this.gain = ac.createGain(); this.gain.gain.value = this._st.volume; this.gain.connect(AudioSys.master);
      const src = ac.createBufferSource(); src.buffer = sound.buffer; src.connect(this.gain);
      if (plays > 1) { src.loop = true; }
      this._t0 = ac.currentTime;
      src.onended = () => { if (!this._stopped) { this._stopped = true; this.dispatchEvent(new Flash_Event('soundComplete')); } };
      src.start(0, offset || 0);
      if (plays > 1 && plays < 999) src.stop(ac.currentTime + plays * sound.buffer.duration - (offset || 0));
      this.src = src;
    } else if (sound.url) {
      const a = new Audio(sound.url); a.volume = Math.max(0, Math.min(1, this._st.volume)); a.loop = plays > 1;
      a.onended = () => { if (!this._stopped) { this._stopped = true; this.dispatchEvent(new Flash_Event('soundComplete')); } };
      const p = a.play(); if (p && p.catch) p.catch(() => { });
      this.audio = a;
    }
  }
  get position() { return AudioSys.ctx && this.src ? (AudioSys.ctx.currentTime - this._t0) * 1000 : (this.audio ? this.audio.currentTime * 1000 : 0); }
  get soundTransform() { return new SoundTransform(this._st.volume, this._st.pan); }
  set soundTransform(st) {
    this._st = new SoundTransform(st.volume, st.pan);
    if (this.gain) this.gain.gain.value = st.volume;
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, st.volume));
  }
  get leftPeak() { return 0; } get rightPeak() { return 0; }
  stop() {
    this._stopped = true;
    try { if (this.src) this.src.stop(); } catch (e) { }
    if (this.audio) this.audio.pause();
  }
}

// ---------------------------------------------------------------- AssetManager
const __imgCache = new Map(), __sndCache = new Map();
function loadImage(url) {
  if (__imgCache.has(url)) return __imgCache.get(url);
  const p = new Promise((res) => {
    const img = document.createElement('img'); img.decoding = 'async';
    if (location.protocol !== 'file:') img.crossOrigin = 'anonymous';
    img.onload = () => res(img); img.onerror = () => { console.warn('image failed', url); res(null); };
    img.src = url;
  });
  __imgCache.set(url, p); return p;
}
function loadSound(url) {
  if (__sndCache.has(url)) return __sndCache.get(url);
  const p = (async () => {
    AudioSys.init();
    if (AudioSys.ctx && location.protocol !== 'file:') {
      try {
        const r = await fetch(url); const ab = await r.arrayBuffer();
        const buf = await new Promise((res, rej) => AudioSys.ctx.decodeAudioData(ab, res, rej));
        return new Sound(buf, url);
      } catch (e) { console.warn('audio decode failed, using <audio>', url, e); }
    }
    return new Sound(null, url);
  })();
  __sndCache.set(url, p); return p;
}
async function loadText(url) {
  if (typeof ASSET_TEXT !== 'undefined' && ASSET_TEXT[url] != null) return ASSET_TEXT[url];
  const r = await fetch((window.ASSET_BASE || 'assets/') + url); return await r.text();
}
function assetName(url) {
  const m = /([^\?\/\\]+?)(?:\.([\w\-]+))?(?:\?.*)?$/.exec(url); return m ? m[1] : url;
}

class AssetManager {
  constructor(scaleFactor = 1, useMipmaps = false) {
    this.mScaleFactor = scaleFactor; this.mQueue = []; this.mVerbose = false;
    this.mTextures = {}; this.mAtlases = {}; this.mSounds = {}; this.mXmls = {}; this.mObjects = {}; this.mByteArrays = {};
  }
  get verbose() { return this.mVerbose; } set verbose(v) { this.mVerbose = v; }
  get useMipMaps() { return false; } set useMipMaps(v) { }
  get scaleFactor() { return this.mScaleFactor; } set scaleFactor(v) { this.mScaleFactor = v; }
  get numQueuedAssets() { return this.mQueue.length; }
  get checkPolicyFile() { return false; } set checkPolicyFile(v) { }
  dispose() { this.purge(); }
  purge() { this.mTextures = {}; this.mAtlases = {}; this.mSounds = {}; this.mXmls = {}; this.mObjects = {}; this.mByteArrays = {}; }
  purgeQueue() { this.mQueue = []; }
  enqueue(...rest) {
    for (let a of rest) {
      if (Array.isArray(a)) { this.enqueue(...a); continue; }
      let path = a instanceof File ? a.url : String(a);
      path = path.replace(/^\/+/, '').replace(/\/+$/, '');
      if (ASSET_MANIFEST.dirs[path]) {
        for (const n of ASSET_MANIFEST.dirs[path]) this.enqueue(new File(path + '/' + n));
      } else if (ASSET_MANIFEST.files[path]) {
        if (/\.DS_Store$|\.ds_store$/i.test(path)) continue;
        this.mQueue.push({ name: assetName(path), url: path });
      } else console.warn('asset not found', path);
    }
  }
  enqueueWithName(asset, name = null) {
    const path = asset instanceof File ? asset.url : String(asset);
    name = name || assetName(path); this.mQueue.push({ name, url: path }); return name;
  }
  loadQueue(onProgress) {
    const q = this.mQueue; this.mQueue = [];
    const total = q.length || 1; let done = 0; const xmls = [];
    const step = () => { done++; if (done < total) onProgress(done / total * 0.95); };
    const base = (window.ASSET_BASE || 'assets/');
    const jobs = q.map(async (it) => {
      const ext = (it.url.split('.').pop() || '').toLowerCase(); const url = base + it.url.split('/').map(encodeURIComponent).join('/');
      try {
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
          const img = await loadImage(url); if (img) this.mTextures[it.name] = new ConcreteTexture(img);
        } else if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'm4a') {
          this.mSounds[it.name] = await loadSound(url);
        } else if (ext === 'json') {
          if (typeof ASSET_JSON !== 'undefined' && ASSET_JSON[it.url]) this.mObjects[it.name] = structuredClone(ASSET_JSON[it.url]);
          else this.mObjects[it.name] = JSON.parse(await loadText(it.url));
        } else if (ext === 'xml' || ext === 'pex' || ext === 'fnt') {
          const x = XML(await loadText(it.url)); xmls.push(x); this.mXmls[it.name] = x;
        } else {
          this.mByteArrays[it.name] = new ByteArray();
        }
      } catch (e) { console.warn('asset load failed', it.url, e); }
      step();
    });
    Promise.all(jobs).then(() => {
      xmls.sort((a, b) => (a.localName() === 'TextureAtlas' ? -1 : 1));
      for (const x of xmls) {
        const rootName = x.localName();
        if (rootName === 'TextureAtlas') {
          const name = assetName(x.attribute('imagePath'));
          const tex = this.mTextures[name];
          if (tex) { this.mAtlases[name] = new TextureAtlas(tex, x); delete this.mTextures[name]; }
        }
      }
      // Starling calls the progress callback from a delayed call
      setTimeout(() => onProgress(1), 0);
    });
  }
  getTexture(name) {
    if (name in this.mTextures) return this.mTextures[name];
    for (const k in this.mAtlases) { const t = this.mAtlases[k].getTexture(name); if (t) return t; }
    return null;
  }
  getTextureNames(prefix = '', out = null) {
    out = out || [];
    for (const k in this.mTextures) if (k.indexOf(prefix) === 0) out.push(k);
    for (const k in this.mAtlases) this.mAtlases[k].getNames(prefix, out);
    out.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
    return out;
  }
  getTextures(prefix = '', out = null) {
    out = out || [];
    for (const n of this.getTextureNames(prefix)) out.push(this.getTexture(n));
    return out;
  }
  getTextureAtlas(n) { return this.mAtlases[n] || null; }
  getSound(n) { return this.mSounds[n] || null; }
  getSoundNames(p = '') { return Object.keys(this.mSounds).filter(k => k.indexOf(p) === 0).sort(); }
  playSound(n, start = 0, loops = 0, st = null) { const s = this.getSound(n); return s ? s.play(start, loops, st) : null; }
  getXml(n) { return this.mXmls[n] || null; }
  getXmlNames(p = '') { return Object.keys(this.mXmls).filter(k => k.indexOf(p) === 0).sort(); }
  getObject(n) { return this.mObjects[n] || null; }
  getObjectNames(p = '') { return Object.keys(this.mObjects).filter(k => k.indexOf(p) === 0).sort(); }
  getByteArray(n) { return this.mByteArrays[n] || null; }
  addTexture(n, t) { this.mTextures[n] = t; }
  addTextureAtlas(n, a) { this.mAtlases[n] = a; }
  addSound(n, s) { this.mSounds[n] = s; }
  addXml(n, x) { this.mXmls[n] = x; }
  addObject(n, o) { this.mObjects[n] = o; }
  addByteArray(n, b) { this.mByteArrays[n] = b; }
  removeTexture(n, dispose = true) { delete this.mTextures[n]; }
  removeTextureAtlas(n, dispose = true) { delete this.mAtlases[n]; }
  removeSound(n) { delete this.mSounds[n]; }
  removeXml(n) { delete this.mXmls[n]; }
  removeObject(n) { delete this.mObjects[n]; }
  removeByteArray(n) { delete this.mByteArrays[n]; }
}

// helper class that lives outside the package block in TextureAtlas.as
class TextureInfo { constructor(region, frame, rotated) { this.region = region; this.frame = frame; this.rotated = rotated; } }
