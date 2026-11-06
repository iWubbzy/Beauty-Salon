// rt_libs.js - GreenSock v11-compatible tweening subset, easing, osflash Signal, loader stubs.
'use strict';

// ---------------------------------------------------------------- easing (t, b, c, d)
const Linear = { easeNone: (t, b, c, d) => c * t / d + b, easeIn: (t, b, c, d) => c * t / d + b, easeOut: (t, b, c, d) => c * t / d + b, easeInOut: (t, b, c, d) => c * t / d + b };
const QuadEase = {
  easeIn: (t, b, c, d) => c * (t /= d) * t + b,
  easeOut: (t, b, c, d) => -c * (t /= d) * (t - 2) + b,
  easeInOut: (t, b, c, d) => ((t /= d / 2) < 1) ? c / 2 * t * t + b : -c / 2 * ((--t) * (t - 2) - 1) + b
};
const Cubic = {
  easeIn: (t, b, c, d) => c * (t /= d) * t * t + b,
  easeOut: (t, b, c, d) => c * ((t = t / d - 1) * t * t + 1) + b,
  easeInOut: (t, b, c, d) => ((t /= d / 2) < 1) ? c / 2 * t * t * t + b : c / 2 * ((t -= 2) * t * t + 2) + b
};
const Quart = {
  easeIn: (t, b, c, d) => c * (t /= d) * t * t * t + b,
  easeOut: (t, b, c, d) => -c * ((t = t / d - 1) * t * t * t - 1) + b,
  easeInOut: (t, b, c, d) => ((t /= d / 2) < 1) ? c / 2 * t * t * t * t + b : -c / 2 * ((t -= 2) * t * t * t - 2) + b
};
const Quint = {
  easeIn: (t, b, c, d) => c * (t /= d) * t * t * t * t + b,
  easeOut: (t, b, c, d) => c * ((t = t / d - 1) * t * t * t * t + 1) + b,
  easeInOut: (t, b, c, d) => ((t /= d / 2) < 1) ? c / 2 * t * t * t * t * t + b : c / 2 * ((t -= 2) * t * t * t * t + 2) + b
};
const Strong = Quint;
const Sine = {
  easeIn: (t, b, c, d) => -c * Math.cos(t / d * (Math.PI / 2)) + c + b,
  easeOut: (t, b, c, d) => c * Math.sin(t / d * (Math.PI / 2)) + b,
  easeInOut: (t, b, c, d) => -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b
};
const Expo = {
  easeIn: (t, b, c, d) => t === 0 ? b : c * Math.pow(2, 10 * (t / d - 1)) + b - c * 0.001,
  easeOut: (t, b, c, d) => t === d ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b,
  easeInOut: (t, b, c, d) => { if (t === 0) return b; if (t === d) return b + c; if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b; return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b; }
};
const Circ = {
  easeIn: (t, b, c, d) => -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b,
  easeOut: (t, b, c, d) => c * Math.sqrt(1 - (t = t / d - 1) * t) + b,
  easeInOut: (t, b, c, d) => ((t /= d / 2) < 1) ? -c / 2 * (Math.sqrt(1 - t * t) - 1) + b : c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b
};
const Back = {
  easeIn: (t, b, c, d, s = 1.70158) => c * (t /= d) * t * ((s + 1) * t - s) + b,
  easeOut: (t, b, c, d, s = 1.70158) => c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b,
  easeInOut: (t, b, c, d, s = 1.70158) => ((t /= d / 2) < 1) ? c / 2 * (t * t * (((s *= 1.525) + 1) * t - s)) + b : c / 2 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2) + b
};
const Bounce = {
  easeOut: (t, b, c, d) => {
    if ((t /= d) < (1 / 2.75)) return c * (7.5625 * t * t) + b;
    if (t < (2 / 2.75)) return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
    if (t < (2.5 / 2.75)) return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
    return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
  },
  easeIn: (t, b, c, d) => c - Bounce.easeOut(d - t, 0, c, d) + b,
  easeInOut: (t, b, c, d) => t < d / 2 ? Bounce.easeIn(t * 2, 0, c, d) * .5 + b : Bounce.easeOut(t * 2 - d, 0, c, d) * .5 + c * .5 + b
};
const Elastic = {
  easeIn: (t, b, c, d, a = 0, p = 0) => {
    if (t === 0) return b; if ((t /= d) === 1) return b + c; if (!p) p = d * .3;
    let s; if (!a || a < Math.abs(c)) { a = c; s = p / 4; } else s = p / (2 * Math.PI) * Math.asin(c / a);
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
  },
  easeOut: (t, b, c, d, a = 0, p = 0) => {
    if (t === 0) return b; if ((t /= d) === 1) return b + c; if (!p) p = d * .3;
    let s; if (!a || a < Math.abs(c)) { a = c; s = p / 4; } else s = p / (2 * Math.PI) * Math.asin(c / a);
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
  },
  easeInOut: (t, b, c, d, a = 0, p = 0) => {
    if (t === 0) return b; if ((t /= d / 2) === 2) return b + c; if (!p) p = d * (.3 * 1.5);
    let s; if (!a || a < Math.abs(c)) { a = c; s = p / 4; } else s = p / (2 * Math.PI) * Math.asin(c / a);
    if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
  }
};

// ---------------------------------------------------------------- tweens
const RESERVED = new Set(['delay', 'ease', 'easeParams', 'onComplete', 'onCompleteParams', 'onCompleteScope', 'onUpdate', 'onUpdateParams',
  'onUpdateScope', 'onStart', 'onStartParams', 'onStartScope', 'yoyo', 'repeat', 'repeatDelay', 'overwrite', 'paused', 'immediateRender',
  'useFrames', 'runBackwards', 'reversed', 'onReverseComplete', 'onReverseCompleteParams', 'startAt', 'roundProps', 'bezierThrough',
  'bezier', 'orientToBezier', 'onRepeat', 'onRepeatParams', 'timeScale', 'onCompleteListener', 'onUpdateListener', 'onStartListener',
  'onInit', 'onInitParams']);

function parseBeziersThrough(props) {
  const all = {};
  for (const p in props) {
    const a = props[p]; const b = all[p] = [];
    if (a.length > 2) {
      b.push([a[0], a[1] - ((a[2] - a[0]) / 4), a[1]]);
      for (let i = 1; i < a.length - 1; i++) b.push([a[i], a[i] + (a[i] - b[i - 1][1]), a[i + 1]]);
    } else b.push([a[0], (a[0] + a[1]) / 2, a[1]]);
  }
  return all;
}

class TweenMax {
  constructor(target, duration, vars = {}) {
    this.target = target; this.duration = Math.max(0, +duration || 0); this.vars = vars || {};
    this.delay = +this.vars.delay || 0;
    this.ease = this.vars.ease || TweenMax.defaultEase;
    this.easeParams = this.vars.easeParams || [];
    this.repeat = this.vars.repeat | 0; this.repeatDelay = +this.vars.repeatDelay || 0; this.yoyo = !!this.vars.yoyo;
    this.time = 0;          // time since creation (includes delay)
    this.initted = false; this.started = false; this.active = true; this.paused = !!this.vars.paused;
    this.timeline = null; this._cycle = -1; this._completed = false;
    this.timeScale = 1;
    TweenMax._register(this);
  }
  get totalDuration() { return this.repeat < 0 ? Infinity : this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat; }
  static to(t, d, v) { return new TweenMax(t, d, v); }
  static from(t, d, v) { v = Object.assign({}, v, { runBackwards: true }); const tw = new TweenMax(t, d, v); if (v.immediateRender !== false) tw._init(); tw._render(0); return tw; }
  static fromTo(t, d, fromVars, toVars) { for (const k in fromVars) t[k] = fromVars[k]; return new TweenMax(t, d, toVars); }
  static set(t, v) { for (const k in v) if (!RESERVED.has(k)) t[k] = v[k]; return null; }
  static delayedCall(delay, fn, params = null) {
    return new TweenMax(fn, 0, { delay: delay, onComplete: fn, onCompleteParams: params, overwrite: 0, __delayed: true });
  }
  static allTo(targets, d, vars, stagger = 0, onCompleteAll = null, params = null) {
    const out = []; let i = 0;
    for (const t of targets) {
      const v = Object.assign({}, vars); v.delay = (+vars.delay || 0) + stagger * i;
      if (onCompleteAll && i === targets.length - 1) {
        const oc = v.onComplete, op = v.onCompleteParams;
        v.onComplete = function () { if (oc) oc.apply(null, op || []); onCompleteAll.apply(null, params || []); };
        v.onCompleteParams = null;
      }
      out.push(new TweenMax(t, d, v)); i++;
    }
    return out;
  }
  static allFrom(targets, d, vars, stagger = 0) { return targets.map((t, i) => TweenMax.from(t, d, Object.assign({}, vars, { delay: (+vars.delay || 0) + stagger * i }))); }
  static killTweensOf(target, complete = false) {
    for (const tw of TweenMax._all.slice()) if (tw.target === target) { if (complete) tw.complete(); tw.kill(); }
  }
  static killDelayedCallsTo(fn) { TweenMax.killTweensOf(fn); }
  static killAll(complete = false, tweens = true, delayedCalls = true) {
    for (const tw of TweenMax._all.slice()) {
      const isDC = tw.vars && tw.vars.__delayed;
      if ((isDC && delayedCalls) || (!isDC && tweens)) { if (complete) tw.complete(); tw.kill(); }
    }
  }
  static killChildTweensOf() { }
  // GreenSock v11 semantics: flip the paused flag on the tweens that exist right now
  // (tweens with a target; delayed calls are tweens whose target is their onComplete).
  // Tweens created afterwards are not affected, and timelines are not included.
  static pauseAll(tweens = true, delayedCalls = true) { TweenMax._changePause(true, tweens, delayedCalls); }
  static resumeAll(tweens = true, delayedCalls = true) { TweenMax._changePause(false, tweens, delayedCalls); }
  static _changePause(pause, tweens = true, delayedCalls = false) {
    for (const tw of TweenMax._all) {
      if (!tw.active || tw.target == null || tw instanceof TimelineMax) continue;
      const isDC = tw.target === tw.vars.onComplete;
      if (isDC === delayedCalls || isDC !== tweens) tw.paused = pause;
    }
  }
  static isTweening(target) { return TweenMax._all.some(t => t.target === target && t.active && t.started); }
  static getTweensOf(target) { return TweenMax._all.filter(t => t.target === target); }
  static getAllTweens() { return TweenMax._all.slice(); }
  static _register(tw) { TweenMax._all.push(tw); }
  static _tick(dt) {
    const list = TweenMax._all.slice();
    for (const tw of list) if (tw.active && !tw.timeline && !tw.paused) tw._advance(dt * tw.timeScale);
    if (TweenMax._dirty) { TweenMax._all = TweenMax._all.filter(t => t.active); TweenMax._dirty = false; }
  }
  _advance(dt) { this._renderTotal(this.time + dt); }
  // render at absolute time (incl. delay)
  _renderTotal(t) {
    this.time = t;
    const local = t - this.delay;
    if (local < 0) return;
    this._renderLocal(local);
  }
  _renderLocal(local) {
    if (!this.active) return;
    if (!this.started) {
      this.started = true;
      if (!this.initted) this._init();
      if (this.vars.onStart) this.vars.onStart.apply(null, this.vars.onStartParams || []);
      if (!this.active) return;
    }
    const total = this.totalDuration;
    let cycleTime = local, done = false;
    if (local >= total) { done = true; cycleTime = local; }
    let ratio;
    if (this.duration === 0) ratio = 1;
    else {
      const period = this.duration + this.repeatDelay;
      let cyc = 0, tt = local;
      if (this.repeat !== 0) { cyc = Math.floor(local / period); tt = local - cyc * period; if (done && this.repeat >= 0) { cyc = this.repeat; tt = this.duration; } }
      if (tt > this.duration) tt = this.duration;
      if (done && this.repeat === 0) tt = this.duration;
      if (this.yoyo && (cyc & 1)) tt = this.duration - tt;
      ratio = this.ease(tt, 0, 1, this.duration, ...this.easeParams);
      if (this.repeat !== 0 && cyc !== this._cycle) { if (this._cycle >= 0 && this.vars.onRepeat) this.vars.onRepeat.apply(null, this.vars.onRepeatParams || []); this._cycle = cyc; }
    }
    this._render(ratio);
    if (this.vars.onUpdate) this.vars.onUpdate.apply(null, this.vars.onUpdateParams || []);
    if (done && this.active && !this._completed) {
      this._completed = true; this.active = false; TweenMax._dirty = true;
      if (this.vars.onComplete) this.vars.onComplete.apply(null, this.vars.onCompleteParams || []);
    }
  }
  _init() {
    this.initted = true;
    const t = this.target, v = this.vars; this.props = [];
    if (typeof t === 'function') return;
    // auto overwrite of overlapping properties on other running tweens of the same target
    if (v.overwrite !== 0 && v.overwrite !== false) {
      const names = Object.keys(v).filter(k => !RESERVED.has(k) && k !== '__delayed');
      if (v.bezierThrough || v.bezier) for (const pt of (v.bezierThrough || v.bezier)) for (const k in pt) names.push(k);
      for (const o of TweenMax._all) {
        if (o === this || o.target !== t || !o.active || !o.initted || !o.props) continue;
        if (o.timeline && o.timeline === this.timeline) continue;
        o.props = o.props.filter(p => names.indexOf(p.name) < 0);
        if (o._bez) for (const n of names) delete o._bez[n];
        if (!o.props.length && !(o._bez && Object.keys(o._bez).length)) { o.active = false; TweenMax._dirty = true; }
      }
    }
    for (const k in v) {
      if (RESERVED.has(k) || k === '__delayed') continue;
      const end = v[k]; let start = +t[k]; if (isNaN(start)) start = 0;
      let change = typeof end === 'string' ? parseFloat(end) : (+end - start);
      if (v.runBackwards) { const s2 = start + change; t[k] = s2; this.props.push({ name: k, start: s2, change: -change, end: start }); }
      else this.props.push({ name: k, start, change, end: typeof end === 'string' ? start + change : +end });
    }
    const bz = v.bezierThrough || v.bezier;
    if (bz) {
      const pts = {};
      for (const pt of bz) for (const k in pt) { if (!pts[k]) { let s = +t[k]; if (isNaN(s)) s = 0; pts[k] = [s]; } }
      for (const k in pts) {
        const s = pts[k][0];
        for (const pt of bz) { const val = pt[k]; pts[k].push(typeof val === 'string' ? s + parseFloat(val) : (val == null ? pts[k][pts[k].length - 1] : +val)); }
      }
      this._bez = v.bezierThrough ? parseBeziersThrough(pts) : parseBeziersThrough(pts);
    }
  }
  _render(ratio) {
    const t = this.target; if (!this.props) return;
    // on the final frame land exactly on the end value (start + change can be off by a few ulps,
    // which breaks the game's "scaleX <= 0.2"-style checks, e.g. rinsing shampoo)
    for (const p of this.props) t[p.name] = ratio === 1 ? p.end : p.start + p.change * ratio;
    if (this._bez) {
      for (const k in this._bez) {
        const segs = this._bez[k]; const n = segs.length; let i, tt;
        if (ratio < 0) i = 0; else if (ratio >= 1) i = n - 1; else i = Math.floor(n * ratio);
        tt = (ratio - i * (1 / n)) * n;
        const b = segs[i];
        t[k] = b[0] + tt * (2 * (1 - tt) * (b[1] - b[0]) + tt * (b[2] - b[0]));
      }
    }
  }
  kill() { this.active = false; TweenMax._dirty = true; }
  complete() { if (!this.active) return; if (!this.initted) this._init(); this._renderLocal(this.totalDuration); }
  pause() { this.paused = true; } resume() { this.paused = false; } play() { this.paused = false; }
  restart() { this.time = 0; this.started = false; this._completed = false; this.active = true; if (TweenMax._all.indexOf(this) < 0) TweenMax._all.push(this); }
  invalidate() { this.initted = false; this.started = false; }
  get currentTime() { return Math.max(0, this.time - this.delay); }
  get totalProgress() { return this.duration ? Math.min(1, this.currentTime / this.totalDuration) : 1; }
}
TweenMax._all = []; TweenMax._dirty = false;
TweenMax.defaultEase = QuadEase.easeOut;
TweenMax.version = 11.698;
const TweenLite = TweenMax;
const TweenNano = TweenMax;

class TimelineMax {
  constructor(vars = {}) {
    this.vars = vars; this.children = []; this.duration = 0; this.time = 0;
    this.delay = +vars.delay || 0; this.timeScale = 1; this.active = true; this.paused = !!vars.paused;
    this.started = false; this._completed = false; this.target = null; this.timeline = null; this.initted = true; this.props = [];
    this.repeat = vars.repeat | 0; this.yoyo = !!vars.yoyo;
    TweenMax._register(this);
  }
  get totalDuration() { return this.duration; }
  append(tw, offset = 0) {
    const arr = Array.isArray(tw) ? tw : [tw];
    let end = this.duration;
    for (const t of arr) {
      t.timeline = this;
      const start = this.duration + offset + (t.delay || 0);
      t._tlStart = start;
      this.children.push(t);
      end = Math.max(end, start + (t.totalDuration === Infinity ? 0 : t.totalDuration));
    }
    this.duration = end;
    return tw;
  }
  appendMultiple(arr, offset = 0, align = 'normal', stagger = 0) { arr.forEach((t, i) => this.insert(t, this.duration + offset + i * stagger)); }
  insert(tw, time = 0) {
    tw.timeline = this; tw._tlStart = (typeof time === 'number' ? time : this.duration) + (tw.delay || 0); this.children.push(tw);
    this.duration = Math.max(this.duration, tw._tlStart + tw.totalDuration); return tw;
  }
  addLabel() { }
  _advance(dt) {
    this.time += dt * this.timeScale;
    const local = this.time - this.delay; if (local < 0) return;
    if (!this.started) { this.started = true; if (this.vars.onStart) this.vars.onStart.apply(null, this.vars.onStartParams || []); }
    const lt = Math.min(local, this.duration);
    for (const c of this.children) {
      if (!c.active) continue;
      const ct = lt - c._tlStart;
      if (ct >= 0) c._renderLocal(Math.min(ct, c.totalDuration));
    }
    if (this.vars.onUpdate) this.vars.onUpdate.apply(null, this.vars.onUpdateParams || []);
    if (local >= this.duration && !this._completed) {
      this._completed = true; this.active = false; TweenMax._dirty = true;
      if (this.vars.onComplete) this.vars.onComplete.apply(null, this.vars.onCompleteParams || []);
    }
  }
  kill() { this.active = false; for (const c of this.children) c.active = false; TweenMax._dirty = true; }
  clear() { for (const c of this.children) c.active = false; this.children = []; this.duration = 0; }
  stop() { this.paused = true; } pause() { this.paused = true; } play() { this.paused = false; } resume() { this.paused = false; }
  complete() { this._advance(this.duration - this.time + this.delay + 0.0001); }
  restart() { this.time = 0; this.started = false; this._completed = false; this.active = true; for (const c of this.children) { c.active = true; c.started = false; c._completed = false; } if (TweenMax._all.indexOf(this) < 0) TweenMax._all.push(this); }
  get currentProgress() { return this.duration ? Math.min(1, Math.max(0, this.time - this.delay) / this.duration) : 1; }
}
const TimelineLite = TimelineMax;

// ---------------------------------------------------------------- loader stubs (MoreApps / remote assets are not available offline)
class LoaderMax extends Flash_EventDispatcher { constructor(vars) { super(); this.vars = vars || {}; } append() { } load() { } dispose() { } }
class ImageLoader extends LoaderMax { constructor(url, vars) { super(vars); this.url = url; this.rawContent = null; } }
class XMLLoader extends ImageLoader { }
class BinaryDataLoader extends ImageLoader { }
class MP3Loader extends ImageLoader { load() { } }
class LoaderEvent extends Flash_Event { }

// ---------------------------------------------------------------- org.osflash.signals.Signal
class Signal {
  constructor(...types) { this.valueClasses = types; this._l = []; }
  get numListeners() { return this._l.length; }
  add(fn) { if (!this._l.some(l => l.fn === fn)) this._l.push({ fn, once: false }); return fn; }
  addOnce(fn) { if (!this._l.some(l => l.fn === fn)) this._l.push({ fn, once: true }); return fn; }
  remove(fn) { this._l = this._l.filter(l => l.fn !== fn); return fn; }
  removeAll() { this._l = []; }
  dispatch(...args) { for (const l of this._l.slice()) { if (l.once) this.remove(l.fn); l.fn(...args); } }
}
