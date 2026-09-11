'use strict';

const KEYS = {
  scEnabled: 'scEnabled',
  scThrottleScroll: 'scThrottleScroll',
  scNoAnim: 'scNoAnim',
  scContain: 'scContain',
  scThrottleMs: 'scThrottleMs'
};

const DEFAULTS = {
  scEnabled: true,
  scThrottleScroll: true,
  scNoAnim: true,
  scContain: true,
  scThrottleMs: 200
};

function init() {
  chrome.storage.sync.get(DEFAULTS, (res) => {
    for (const key of Object.keys(KEYS)) {
      const el = document.getElementById(key);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!res[key];
      else el.value = res[key];
    }
    updateMsLabel();
  });

  for (const key of Object.keys(KEYS)) {
    const el = document.getElementById(key);
    if (!el) continue;
    el.addEventListener('change', () => {
      const value = el.type === 'checkbox' ? el.checked : Number(el.value);
      chrome.storage.sync.set({ [key]: value }, updateMsLabel);
    });
  }
}

function updateMsLabel() {
  const el = document.getElementById('scThrottleMs');
  const label = document.getElementById('msVal');
  if (el && label) label.textContent = el.value + 'ms';
}

document.addEventListener('DOMContentLoaded', init);
