/**
 * AI Chat Smooth - content script
 * 优化 GPT / DeepSeek 流式回复时的页面卡顿：
 *  1. 节流高频 scroll / scrollTo / scrollIntoView 调用，并强制瞬时滚动
 *  2. 通过 CSS 类隔离消息布局（contain: layout style），减少整页重排
 *  3. 关闭流式期间的 CSS animation / transition
 *  4. 提供右下角可拖拽的开关按钮
 */
(() => {
  'use strict';

  const DEFAULTS = {
    scEnabled: true,       // 总开关（自动开启）
    scThrottleScroll: true, // 滚动节流
    scNoAnim: true,         // 禁用动画
    scContain: true,        // 消息布局隔离
    scThrottleMs: 200       // 滚动节流间隔（毫秒）
  };

  let settings = { ...DEFAULTS };
  let active = false;
  let btn = null;
  let tip = null;

  // ---------- 设置 ----------
  let settingsFromCache = null;
  function applySettingsFromStorage(patch) {
    Object.assign(settings, { ...DEFAULTS, ...(patch || {}) });
    sync();
  }

  try {
    chrome.storage.sync.get(DEFAULTS, (res) => {
      settingsFromCache = res;
      applySettingsFromStorage(res);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const patch = {};
      for (const key of Object.keys(DEFAULTS)) {
        if (changes[key]) patch[key] = changes[key].newValue;
      }
      if (Object.keys(patch).length) applySettingsFromStorage(patch);
    });
  } catch (e) {
    /* 非浏览器环境，使用默认值 */
    sync();
  }

  // ---------- 滚动节流 ----------
  let lastRun = 0;
  let pendingFn = null;
  let timer = null;

  function runThrottled(fn) {
    pendingFn = fn;
    const now = performance.now();
    const elapsed = now - lastRun;
    const interval = Number(settings.scThrottleMs) || 200;
    if (elapsed >= interval) {
      lastRun = now;
      const f = pendingFn;
      pendingFn = null;
      if (timer) { clearTimeout(timer); timer = null; }
      f();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastRun = performance.now();
        const f = pendingFn;
        pendingFn = null;
        if (f) f();
      }, interval - elapsed);
    }
  }

  const nativeScrollTo = Element.prototype.scrollTo;
  const nativeScroll  = Element.prototype.scroll;
  const nativeWinScroll = Window.prototype.scroll;
  const nativeScrollIntoView = Element.prototype.scrollIntoView;

  function patchScroll() {
    Element.prototype.scrollTo = function (...args) {
      if (!active || !settings.scThrottleScroll) return nativeScrollTo.apply(this, args);
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        args = [args[0].left ?? 0, args[0].top ?? 0]; // 去掉 smooth behavior
      }
      if (args.length >= 3) args[2] = 'auto';
      runThrottled(() => nativeScrollTo.apply(this, args));
    };
    Element.prototype.scroll = function (...args) {
      if (!active || !settings.scThrottleScroll) return nativeScroll.apply(this, args);
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        args = [args[0].left ?? 0, args[0].top ?? 0];
      }
      if (args.length >= 3) args[2] = 'auto';
      runThrottled(() => nativeScroll.apply(this, args));
    };
    Window.prototype.scroll = function (...args) {
      if (!active || !settings.scThrottleScroll) return nativeWinScroll.apply(this, args);
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        args = [args[0].left ?? 0, args[0].top ?? 0];
      }
      if (args.length >= 3) args[2] = 'auto';
      runThrottled(() => nativeWinScroll.apply(this, args));
    };
    Element.prototype.scrollIntoView = function (options) {
      if (!active || !settings.scThrottleScroll) return nativeScrollIntoView.call(this, options);
      const opts = (options && typeof options === 'object') ? { ...options, behavior: 'auto' } : options;
      runThrottled(() => nativeScrollIntoView.call(this, opts));
    };
  }

  function unpatchScroll() {
    if (timer) { clearTimeout(timer); timer = null; }
    pendingFn = null;
    Element.prototype.scrollTo = nativeScrollTo;
    Element.prototype.scroll = nativeScroll;
    Window.prototype.scroll = nativeWinScroll;
    Element.prototype.scrollIntoView = nativeScrollIntoView;
  }

  // ---------- 开关 ----------
  function sync() {
    const want = !!settings.scEnabled;
    if (want === active) {
      updateButton(); // 仅刷新按钮（节流间隔等变化）
      return;
    }
    active = want;
    document.documentElement.classList.toggle('sc-on', active);
    document.documentElement.classList.toggle('sc-noanim', active && !!settings.scNoAnim);
    document.documentElement.classList.toggle('sc-contain', active && !!settings.scContain);
    if (active) patchScroll(); else unpatchScroll();
    updateButton();
  }

  function setEnabled(on) {
    settings.scEnabled = on;
    try { chrome.storage.sync.set({ scEnabled: on }); } catch (e) { /* ignore */ }
    sync();
  }

  // ---------- UI：可拖拽悬浮按钮 ----------
  function createButton() {
    if (document.getElementById('sc-toggle-btn')) return;
    btn = document.createElement('div');
    btn.id = 'sc-toggle-btn';
    btn.title = 'AI Chat Smooth：点击开关性能优化';
    btn.textContent = '⚡';
    document.body.appendChild(btn);

    tip = document.createElement('div');
    tip.id = 'sc-tip';
    document.body.appendChild(tip);

    btn.addEventListener('click', () => setEnabled(!settings.scEnabled));

    let dragging = false;
    let moved = false;
    let offsetX = 0, offsetY = 0;
    btn.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      const rect = btn.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      moved = true;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      x = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, y));
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      showTip();
    });
    btn.addEventListener('pointerup', (e) => {
      dragging = false;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      hideTip();
    });
    btn.addEventListener('pointerenter', () => { if (!dragging) showTip(); });
    btn.addEventListener('pointerleave', () => { if (!dragging) hideTip(); });
  }

  function showTip() {
    if (!tip || !btn) return;
    const rect = btn.getBoundingClientRect();
    tip.textContent = active
      ? '优化已开启（点击关闭 / 拖动改变位置）'
      : '优化已关闭（点击开启）';
    tip.style.left = Math.max(4, rect.left - 190) + 'px';
    tip.style.top = (rect.top + rect.height / 2 - 12) + 'px';
    tip.style.display = 'block';
  }

  function hideTip() {
    if (tip) tip.style.display = 'none';
  }

  function updateButton() {
    if (!btn) return;
    btn.classList.toggle('sc-off', !active);
    btn.textContent = active ? '⚡' : '⏸';
  }

  // ---------- 启动 ----------
  function start() {
    createButton();
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

