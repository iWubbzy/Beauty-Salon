// main.js - HTML5 entry point. Mirrors WubbzysBeautySalon (the AIR document class).
'use strict';

(function () {
  $runDeferred();

  function boot() {
    // Same rule as the AIR app: on screens narrower than 16:9 the stage sides are cropped and
    // edge-anchored UI (back/next arrows, etc.) moves inward by the cropped amount.
    // The framing is chosen at start-up, as in the original (reload after resizing to re-frame).
    Starling.fixedVisW = Starling.visibleStageWidth();
    Costanza.SCREEN_START_X = Math.round((STAGE_W - Starling.fixedVisW) / 2);
    Costanza.WIDESCREEN_WIDTH_OFFSET = -Costanza.SCREEN_START_X;
    Costanza.VIEWPORT_WIDTH = STAGE_W; Costanza.VIEWPORT_HEIGHT = STAGE_H;
    Costanza.VIEWPORT_OFFSET = 0;

    const so = SharedObject.getLocal('WubbzyBeautySavedObject');
    WubbzysBeautySalon.savedVariablesObject = so;
    so.data.musicVolume >= 0 ? (Costanza.musicVolume = so.data.musicVolume) : (so.data.musicVolume = Costanza.musicVolume);
    so.data.voiceVolume >= 0 ? (Costanza.voiceVolume = so.data.voiceVolume) : (so.data.voiceVolume = Costanza.voiceVolume);
    so.data.soundVolume >= 0 ? (Costanza.soundVolume = so.data.soundVolume) : (so.data.soundVolume = Costanza.soundVolume);
    so.flush();

    const app = File.applicationDirectory;
    const assets = new AssetManager(Costanza.SCALE_FACTOR, Costanza.mipmapsEnabled);
    assets.enqueue(app.resolvePath('audio/mainRoom'), app.resolvePath('audio/loadScreens'), app.resolvePath('audio/Global'),
      app.resolvePath('textures/' + Costanza.SCALE_FACTOR + 'x/loadScreens'), app.resolvePath('textures/' + Costanza.SCALE_FACTOR + 'x/promo'),
      app.resolvePath('textures/' + Costanza.SCALE_FACTOR + 'x/globalAssets'), app.resolvePath('fonts'));

    const canvas = document.getElementById('stage');
    const st = new Starling(Root, canvas);
    const bg = Texture.fromEmbeddedAsset(splash_png, false, false, Costanza.SCALE_FACTOR);
    st.root.start(bg, assets);

    document.addEventListener('visibilitychange', () => {
      const sm = SoundManager.getInstance();
      if (document.hidden) { st.stop(); sm.muteAll(true); if (AudioSys.ctx) AudioSys.ctx.suspend(); }
      else { st.start(); sm.muteAll(false); AudioSys.resume(); }
    });
    window.WBZ = { starling: st, assets };
  }

  function preload(list) {
    return Promise.all(list.map(([k, src]) => new Promise(res => { const i = document.createElement('img'); i.onload = () => { EMBEDDED[k] = i; res(); }; i.onerror = res; i.src = src; })));
  }

  const B = window.ASSET_BASE || 'assets/';
  preload([['splash', B + 'embedded/splash.png'], ['load_1', B + 'embedded/load_1.png'], ['load_2', B + 'embedded/load_2.png']]).then(() => {
    const gate = document.getElementById('gate');
    const go = () => {
      gate.removeEventListener('pointerup', go);
      AudioSys.init(); AudioSys.resume();
      gate.remove();
      boot();
    };
    gate.classList.add('ready');
    gate.addEventListener('pointerup', go);
    if (/[?&]autostart/.test(location.search)) go();
  });
})();

// ---- test/debug helpers (used by the automated browser tests)
window.WBZ_scene = function () { const c = WBZ.starling.root.mSceneContainer; return c && c.numChildren ? c.getChildAt(c.numChildren - 1) : null; };
window.WBZ_center = function (obj) { if (!obj || !obj.stage) return null; const b = obj.getBounds(obj.stage); return WBZ.starling.stageToClient(b.x + b.width / 2, b.y + b.height / 2); };
