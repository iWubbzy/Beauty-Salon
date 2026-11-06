// rt_core.js - AS3 language helpers, flash.geom, flash.events, misc flash.* stand-ins.
'use strict';

// ---------------------------------------------------------------- language helpers
function trace(...a) { if (window.WBZ_DEBUG) console.log(...a); }
function $int(v) { v = +v; return (v | 0); }
function $uint(v) { v = +v; return v >>> 0; }
const __deferred = [];
function $defer(fn) { __deferred.push(fn); }
function $runDeferred() {
  for (const fn of __deferred) {
    try { fn(); } catch (e) { console.error('static init failed', e); }
  }
  __deferred.length = 0;
}
function $each(o) {
  if (o == null) return [];
  if (Array.isArray(o)) return o;
  if (o instanceof XMLList) return o.items;
  if (typeof o[Symbol.iterator] === 'function' && !(typeof o === 'string')) return o;
  return Object.keys(o).map(k => o[k]);
}
function $Vector(n, fixed) { const a = []; if (typeof n === 'number' && n > 0) { for (let i = 0; i < n; i++) a.push(0); } return a; }
function $toVector(src) { return Array.from(src || []); }
const __boundCache = new WeakMap();
function $fn(obj, name) {
  if (obj == null) return undefined;
  const f = obj[name];
  if (typeof f !== 'function') return f;
  if (Object.prototype.hasOwnProperty.call(obj, name)) return f;
  let m = __boundCache.get(obj);
  if (!m) { m = new Map(); __boundCache.set(obj, m); }
  let b = m.get(f);
  if (!b) { b = f.bind(obj); m.set(f, b); }
  return b;
}
function $iface(name, ext) {
  const o = { __iface: name, __ext: ext };
  o[Symbol.hasInstance] = (v) => {
    if (v == null || typeof v !== 'object') return false;
    let c = v.constructor;
    while (c) {
      if (c.__ifaces && c.__ifaces.some(n => n === name || (window[n] && window[n].__ext && window[n].__ext.includes(name)))) return true;
      c = Object.getPrototypeOf(c);
    }
    return false;
  };
  return o;
}
const $String = { [Symbol.hasInstance]: v => typeof v === 'string' };
const $Number = { [Symbol.hasInstance]: v => typeof v === 'number' };
const $Int = { [Symbol.hasInstance]: v => typeof v === 'number' && (v | 0) === v };
const $Uint = { [Symbol.hasInstance]: v => typeof v === 'number' && (v >>> 0) === v };
const $Boolean = { [Symbol.hasInstance]: v => typeof v === 'boolean' };
const $Function = { [Symbol.hasInstance]: v => typeof v === 'function' };
const $Object = { [Symbol.hasInstance]: v => v != null };
const $Class = { [Symbol.hasInstance]: v => typeof v === 'function' };
const $XML = { [Symbol.hasInstance]: v => v instanceof XMLNode };

function getTimer() { return Math.round(performance.now()); }
function getQualifiedClassName(o) {
  if (o == null) return 'null';
  const c = typeof o === 'function' ? o : o.constructor;
  return (c && (c.__name || c.name)) || 'Object';
}
function getDefinitionByName(n) { return window[n.split(/[.:]+/).pop()]; }
// Store links use app-only URL schemes; send them to the equivalent web store pages.
function webURL(url) {
  let m = /^market:\/\/details\?id=(.+)$/.exec(url);
  if (m) return 'https://play.google.com/store/apps/details?id=' + m[1];
  m = /^itms-apps:\/\/itunes\.com\/apps\/(.+)$/.exec(url);
  if (m) return 'https://apps.apple.com/us/search?term=' + encodeURIComponent(m[1]);
  return url;
}
function navigateToURL(req) {
  const url = webURL(req && req.url ? req.url : String(req));
  if (window.wbzNative && window.wbzNative.openExternal) { window.wbzNative.openExternal(url); return; }
  try { window.open(url, '_blank', 'noopener'); } catch (e) { }
}

class Dictionary { constructor() { } }
class ArgumentError extends Error { }
class IllegalOperationError extends Error { }
class Flash_Error extends Error { }

// ---------------------------------------------------------------- flash.geom
class Point {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  get length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  setTo(x, y) { this.x = x; this.y = y; }
  copyFrom(p) { this.x = p.x; this.y = p.y; }
  clone() { return new Point(this.x, this.y); }
  add(p) { return new Point(this.x + p.x, this.y + p.y); }
  subtract(p) { return new Point(this.x - p.x, this.y - p.y); }
  offset(dx, dy) { this.x += dx; this.y += dy; }
  equals(p) { return p && p.x === this.x && p.y === this.y; }
  normalize(t) { const l = this.length; if (l > 0) { this.x *= t / l; this.y *= t / l; } }
  toString() { return '(x=' + this.x + ', y=' + this.y + ')'; }
  static distance(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  static interpolate(a, b, f) { return new Point(b.x + (a.x - b.x) * f, b.y + (a.y - b.y) * f); }
  static polar(len, ang) { return new Point(len * Math.cos(ang), len * Math.sin(ang)); }
}
class Rectangle {
  constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; }
  get left() { return this.x; } set left(v) { this.width -= v - this.x; this.x = v; }
  get top() { return this.y; } set top(v) { this.height -= v - this.y; this.y = v; }
  get right() { return this.x + this.width; } set right(v) { this.width = v - this.x; }
  get bottom() { return this.y + this.height; } set bottom(v) { this.height = v - this.y; }
  get topLeft() { return new Point(this.x, this.y); }
  get bottomRight() { return new Point(this.right, this.bottom); }
  get size() { return new Point(this.width, this.height); }
  setTo(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }
  copyFrom(r) { this.setTo(r.x, r.y, r.width, r.height); }
  clone() { return new Rectangle(this.x, this.y, this.width, this.height); }
  contains(x, y) { return x >= this.x && y >= this.y && x < this.x + this.width && y < this.y + this.height; }
  containsPoint(p) { return this.contains(p.x, p.y); }
  containsRect(r) { return r.x >= this.x && r.y >= this.y && r.right <= this.right && r.bottom <= this.bottom; }
  intersects(r) { return !(r.x >= this.right || r.right <= this.x || r.y >= this.bottom || r.bottom <= this.y) && this.width > 0 && this.height > 0 && r.width > 0 && r.height > 0; }
  intersection(r) {
    const x0 = Math.max(this.x, r.x), y0 = Math.max(this.y, r.y), x1 = Math.min(this.right, r.right), y1 = Math.min(this.bottom, r.bottom);
    if (x1 <= x0 || y1 <= y0) return new Rectangle();
    return new Rectangle(x0, y0, x1 - x0, y1 - y0);
  }
  union(r) {
    if (this.isEmpty()) return r.clone(); if (r.isEmpty()) return this.clone();
    const x0 = Math.min(this.x, r.x), y0 = Math.min(this.y, r.y);
    return new Rectangle(x0, y0, Math.max(this.right, r.right) - x0, Math.max(this.bottom, r.bottom) - y0);
  }
  inflate(dx, dy) { this.x -= dx; this.y -= dy; this.width += 2 * dx; this.height += 2 * dy; }
  offset(dx, dy) { this.x += dx; this.y += dy; }
  isEmpty() { return this.width <= 0 || this.height <= 0; }
  setEmpty() { this.setTo(0, 0, 0, 0); }
  equals(r) { return r && r.x === this.x && r.y === this.y && r.width === this.width && r.height === this.height; }
  toString() { return '(x=' + this.x + ', y=' + this.y + ', w=' + this.width + ', h=' + this.height + ')'; }
}
class Matrix {
  constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) { this.a = a; this.b = b; this.c = c; this.d = d; this.tx = tx; this.ty = ty; }
  setTo(a, b, c, d, tx, ty) { this.a = a; this.b = b; this.c = c; this.d = d; this.tx = tx; this.ty = ty; }
  copyFrom(m) { this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.tx = m.tx; this.ty = m.ty; }
  clone() { return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty); }
  identity() { this.setTo(1, 0, 0, 1, 0, 0); }
  // this = this * m  (apply this first, then m) -- flash semantics
  concat(m) {
    const a = this.a * m.a + this.b * m.c, b = this.a * m.b + this.b * m.d;
    const c = this.c * m.a + this.d * m.c, d = this.c * m.b + this.d * m.d;
    const tx = this.tx * m.a + this.ty * m.c + m.tx, ty = this.tx * m.b + this.ty * m.d + m.ty;
    this.a = a; this.b = b; this.c = c; this.d = d; this.tx = tx; this.ty = ty;
  }
  invert() {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) { this.setTo(0, 0, 0, 0, -this.tx, -this.ty); return; }
    const a = this.d / det, b = -this.b / det, c = -this.c / det, d = this.a / det;
    const tx = -(a * this.tx + c * this.ty), ty = -(b * this.tx + d * this.ty);
    this.setTo(a, b, c, d, tx, ty);
  }
  translate(dx, dy) { this.tx += dx; this.ty += dy; }
  scale(sx, sy) { this.a *= sx; this.b *= sy; this.c *= sx; this.d *= sy; this.tx *= sx; this.ty *= sy; }
  rotate(r) { const cos = Math.cos(r), sin = Math.sin(r); this.concat(new Matrix(cos, sin, -sin, cos, 0, 0)); }
  createBox(sx, sy, r = 0, tx = 0, ty = 0) {
    const cos = Math.cos(r), sin = Math.sin(r);
    this.setTo(cos * sx, sin * sy, -sin * sx, cos * sy, tx, ty);
  }
  transformPoint(p) { return new Point(this.a * p.x + this.c * p.y + this.tx, this.b * p.x + this.d * p.y + this.ty); }
  deltaTransformPoint(p) { return new Point(this.a * p.x + this.c * p.y, this.b * p.x + this.d * p.y); }
  toString() { return '(a=' + this.a + ', b=' + this.b + ', c=' + this.c + ', d=' + this.d + ', tx=' + this.tx + ', ty=' + this.ty + ')'; }
}
class Matrix3D { constructor() { this.rawData = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; } identity() { } copyFrom() { } append() { } }
class Vector3D { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } }
class ColorTransform {
  constructor(rm = 1, gm = 1, bm = 1, am = 1, ro = 0, go = 0, bo = 0, ao = 0) {
    Object.assign(this, { redMultiplier: rm, greenMultiplier: gm, blueMultiplier: bm, alphaMultiplier: am, redOffset: ro, greenOffset: go, blueOffset: bo, alphaOffset: ao });
  }
  get color() { return (this.redOffset << 16) | (this.greenOffset << 8) | this.blueOffset; }
  set color(c) { this.redMultiplier = this.greenMultiplier = this.blueMultiplier = 0; this.redOffset = (c >> 16) & 255; this.greenOffset = (c >> 8) & 255; this.blueOffset = c & 255; }
}

// ---------------------------------------------------------------- flash.events
class Flash_Event {
  constructor(type, bubbles = false, cancelable = false) { this.type = type; this.bubbles = bubbles; this.cancelable = cancelable; this.target = null; this.currentTarget = null; this._stop = false; }
  clone() { return new this.constructor(this.type, this.bubbles, this.cancelable); }
  stopPropagation() { this._stop = true; } stopImmediatePropagation() { this._stop = true; } preventDefault() { }
}
class Flash_EventDispatcher {
  constructor() { }
  addEventListener(type, fn) {
    if (!this.__fl) this.__fl = {};
    const a = this.__fl[type] || (this.__fl[type] = []);
    if (a.indexOf(fn) < 0) a.push(fn);
  }
  removeEventListener(type, fn) {
    const a = this.__fl && this.__fl[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  }
  hasEventListener(type) { return !!(this.__fl && this.__fl[type] && this.__fl[type].length); }
  willTrigger(type) { return this.hasEventListener(type); }
  dispatchEvent(ev) {
    ev.target = ev.target || this; ev.currentTarget = this;
    const a = this.__fl && this.__fl[ev.type];
    if (a) for (const f of a.slice()) f(ev);
    return true;
  }
}

// ---------------------------------------------------------------- misc flash.* stand-ins
const Capabilities = { isDebugger: false, manufacturer: 'HTML5', os: 'HTML5 Browser', screenResolutionX: 1366, screenResolutionY: 768, screenDPI: 96, version: 'HTML 1,0,0,0', playerType: 'Desktop', language: 'en' };
const System = { gc() { }, pauseForGCIfCollectionImminent() { }, totalMemory: 0, freeMemory: 0 };
const NativeApplication = { nativeApplication: Object.assign(new Flash_EventDispatcher(), { systemIdleMode: 'normal', exit() { } }) };
const Mouse = { hide() { }, show() { }, cursor: 'auto' };
class URLRequest { constructor(url) { this.url = url; } }
class ByteArray { constructor() { this.length = 0; this.position = 0; } readUTFBytes() { return ''; } }
class SoundTransform { constructor(volume = 1, pan = 0) { this.volume = volume; this.pan = pan; } }
class ApplicationDomain { static get currentDomain() { return new ApplicationDomain(); } hasDefinition() { return false; } }
class LoaderContext { }
class PNGEncoderOptions { }
class Flash_Sprite extends Flash_EventDispatcher { constructor() { super(); this.x = 0; this.y = 0; this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild(c) { } removeChildren() { this.children = []; } get numChildren() { return this.children.length; } }
class Flash_MovieClip extends Flash_Sprite { gotoAndStop() { } get totalFrames() { return 1; } }
class Loader extends Flash_Sprite { }

class File {
  constructor(path = '') { this.nativePath = this.url = path; }
  static get applicationDirectory() { return new File(''); }
  static get applicationStorageDirectory() { return new File('app-storage:'); }
  resolvePath(p) { return new File(this.url ? this.url + '/' + p : p); }
  get exists() { return !!(ASSET_MANIFEST.files[this.url] || ASSET_MANIFEST.dirs[this.url]); }
  get isDirectory() { return !!ASSET_MANIFEST.dirs[this.url]; }
  get name() { return this.url.split('/').pop(); }
  get extension() { const n = this.name; const i = n.lastIndexOf('.'); return i >= 0 ? n.slice(i + 1) : null; }
  getDirectoryListing() { return (ASSET_MANIFEST.dirs[this.url] || []).map(n => this.resolvePath(n)); }
}
class FileStream { open() { } close() { } readUTFBytes() { return ''; } writeUTFBytes() { } get bytesAvailable() { return 0; } }

// SharedObject on localStorage
class SharedObject {
  static getLocal(name) {
    const so = new SharedObject(); so._key = 'wbz_so_' + name;
    try { so.data = JSON.parse(localStorage.getItem(so._key) || '{}'); } catch (e) { so.data = {}; }
    return so;
  }
  flush() { try { localStorage.setItem(this._key, JSON.stringify(this.data)); } catch (e) { } }
}

// BitmapData backed by a canvas
class BitmapData {
  constructor(w, h, transparent = true, fill = 0xFFFFFFFF) {
    this.canvas = document.createElement('canvas'); this.canvas.width = Math.max(1, w | 0); this.canvas.height = Math.max(1, h | 0);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.transparent = transparent;
    if (fill !== 0 || !transparent) this.fillRect(new Rectangle(0, 0, w, h), transparent ? fill : (fill | 0xFF000000));
  }
  get width() { return this.canvas.width; } get height() { return this.canvas.height; }
  get rect() { return new Rectangle(0, 0, this.width, this.height); }
  fillRect(r, c) {
    c = c >>> 0; this.ctx.clearRect(r.x, r.y, r.width, r.height);
    const a = ((c >>> 24) & 255) / 255;
    this.ctx.fillStyle = 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';
    this.ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  getPixel32(x, y) { const d = this.ctx.getImageData(x, y, 1, 1).data; return ((d[3] << 24) | (d[0] << 16) | (d[1] << 8) | d[2]) >>> 0; }
  getPixel(x, y) { return this.getPixel32(x, y) & 0xFFFFFF; }
  setPixel32(x, y, c) { this.fillRect(new Rectangle(x, y, 1, 1), c); }
  draw(src, m) {
    const s = src && (src.canvas || src.bitmapData && src.bitmapData.canvas || src.image);
    if (!s) return;
    this.ctx.save(); if (m) this.ctx.setTransform(m.a, m.b, m.c, m.d, m.tx, m.ty);
    this.ctx.drawImage(s, 0, 0); this.ctx.restore();
  }
  copyPixels(src, r, p) { this.ctx.drawImage(src.canvas, r.x, r.y, r.width, r.height, p.x, p.y, r.width, r.height); }
  clone() { const b = new BitmapData(this.width, this.height, this.transparent, 0); b.ctx.drawImage(this.canvas, 0, 0); return b; }
  dispose() { }
  lock() { } unlock() { }
}
class Bitmap {
  constructor(bd = null) { this.bitmapData = bd; this.x = 0; this.y = 0; this.smoothing = true; }
  get width() { return this.bitmapData ? this.bitmapData.width : 0; } set width(v) { }
  get height() { return this.bitmapData ? this.bitmapData.height : 0; } set height(v) { }
}

// ---------------------------------------------------------------- tiny E4X-style XML
class XMLNode {
  constructor(el) { this.el = el; }
  attribute(n) { const v = this.el.getAttribute(n); return v == null ? '' : v; }
  localName() { return this.el.localName; }
  name() { return this.el.localName; }
  children() { return new XMLList(Array.from(this.el.children).map(e => new XMLNode(e))); }
  child(n) { return new XMLList(Array.from(this.el.children).filter(e => e.localName === n).map(e => new XMLNode(e))); }
  toString() { return this.el.textContent; }
  toXMLString() { return new XMLSerializer().serializeToString(this.el); }
  length() { return 1; }
}
class XMLList {
  constructor(items) { this.items = items; }
  attribute(n) { return this.items.length ? this.items[0].attribute(n) : ''; }
  length() { return this.items.length; }
  child(n) { return new XMLList([].concat(...this.items.map(i => i.child(n).items))); }
  children() { return new XMLList([].concat(...this.items.map(i => i.children().items))); }
  toString() { return this.items.map(i => i.toString()).join(''); }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
}
// property access by child name (config.gravity.attribute("x"))
function $xmlProxy(target) {
  return new Proxy(target, {
    get(t, p, r) {
      if (typeof p === 'symbol' || p in t) { const v = Reflect.get(t, p, r); return typeof v === 'function' ? v.bind(t) : v; }
      if (/^\d+$/.test(p)) { const it = t instanceof XMLList ? t.items[+p] : (p === '0' ? t : undefined); return it ? $xmlProxy(it) : undefined; }
      return $xmlProxy(t.child(p));
    }
  });
}
function XML(src) {
  if (src instanceof XMLNode || src instanceof XMLList) return src;
  const doc = new DOMParser().parseFromString(String(src), 'application/xml');
  return $xmlProxy(new XMLNode(doc.documentElement));
}

// AS3 casts: `x as T` -> value or null;  T(x) -> value (no conversion for class types)
function $as(v, T) { try { return (v instanceof T) ? v : null; } catch (e) { return null; } }
function $cast(T, v) { return v; }
function $mergePre(self, pre) { for (const k of Object.keys(pre)) if (!Object.prototype.hasOwnProperty.call(self, k)) self[k] = pre[k]; }

// AS3 Array.sort(options) / sortOn: CASEINSENSITIVE=1 DESCENDING=2 UNIQUESORT=4 RETURNINDEXEDARRAY=8 NUMERIC=16
(function () {
  const nativeSort = Array.prototype.sort;
  function cmpFor(opts) {
    return (a, b) => {
      let x = a, y = b;
      if (opts & 16) { x = +x; y = +y; }
      else { x = String(x); y = String(y); if (opts & 1) { x = x.toLowerCase(); y = y.toLowerCase(); } }
      const r = x < y ? -1 : x > y ? 1 : 0;
      return (opts & 2) ? -r : r;
    };
  }
  Object.defineProperty(Array.prototype, 'sort', {
    configurable: true, writable: true, value: function (f, opts) {
      if (typeof f === 'number') { opts = f; f = cmpFor(opts); }
      else if (typeof f === 'function' && typeof opts === 'number' && (opts & 2)) { const g = f; f = (a, b) => -g(a, b); }
      if (opts & 8) { const idx = this.map((v, i) => i); nativeSort.call(idx, (i, j) => f(this[i], this[j])); return idx; }
      return nativeSort.call(this, f);
    }
  });
  Object.defineProperty(Array.prototype, 'sortOn', {
    configurable: true, writable: true, value: function (name, opts = 0) {
      const c = cmpFor(typeof opts === 'number' ? opts : 0);
      return nativeSort.call(this, (a, b) => c(a[name], b[name]));
    }
  });
})();
const $SELF = { toString() { return "[self]"; } };
function $str(v) { return v == null ? null : String(v); }
