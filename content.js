// Content script: injects Next/Prev buttons and an optional keyboard
// shortcut on any page matching one of the configured rules (see rules.js).
// Loaded after rules.js - see manifest.json content_scripts order.

// --- module state (declared up front so nothing hits a temporal dead zone
// if chrome.storage's callback ever runs synchronously) ---
let activeMatch = null;       // { rule, match } for the current page, or null
let panelEnabled = true;      // "show buttons on the page" setting
let shortcutsEnabled = false; // "keyboard shortcut" setting
let keydownAttached = false;
let observer = null;

function getSettings(cb) {
  chrome.storage.sync.get(
    { rules: null, shortcutsEnabled: true, showPanel: true },
    (data) => {
      const rules = data.rules && data.rules.length ? data.rules : DEFAULT_RULES;
      cb(rules, data.shortcutsEnabled, data.showPanel !== false);
    }
  );
}

function navigate(delta) {
  if (!activeMatch) return;
  const nextUrl = computeAdjacentUrl(window.location.href, activeMatch.rule, delta);
  if (nextUrl) window.location.href = nextUrl;
}

// --- on-page Next/Prev panel ------------------------------------------------

function removeNavigationButtons() {
  const el = document.getElementById('url-nav-extension');
  if (el) el.remove();
}

function addNavigationButtons(rule) {
  if (document.getElementById('url-nav-extension')) return;

  const label = rule.label || 'Part';
  const navContainer = document.createElement('div');
  navContainer.id = 'url-nav-extension';
  navContainer.style.cssText = `
    position: fixed;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: Arial, sans-serif;
  `;

  const makeBtn = (text, color, hoverColor, onClick) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 15px;
      background: ${color};
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      transition: background 0.3s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = hoverColor; });
    btn.addEventListener('mouseleave', () => { btn.style.background = color; });
    btn.addEventListener('click', onClick);
    return btn;
  };

  // Small "hide" button - turns the on-page panel off (persisted), right
  // from where it might be covering the page. Re-enable it from the popup.
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = 'Hide these buttons (re-enable in the extension popup)';
  close.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    padding: 0;
    line-height: 18px;
    background: #555;
    color: #fff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
  `;
  close.addEventListener('click', () => chrome.storage.sync.set({ showPanel: false }));
  navContainer.appendChild(close);

  navContainer.appendChild(makeBtn(`Next ${label}`, '#4CAF50', '#45a049', () => navigate(1)));
  navContainer.appendChild(makeBtn(`Prev ${label}`, '#2196F3', '#1976D2', () => navigate(-1)));
  document.body.appendChild(navContainer);
}

// Show the on-page panel only when a rule matches AND the user hasn't
// switched it off. The keyboard shortcut and the popup buttons are
// unaffected by this toggle.
function refreshPanel() {
  if (activeMatch && panelEnabled) {
    addNavigationButtons(activeMatch.rule);
    startObserver();
  } else {
    removeNavigationButtons();
    stopObserver();
  }
}

// Re-add the panel if the host page's own script wipes the DOM subtree it
// lives in (common on reader sites that re-render on navigation). Observed
// only while the panel should be showing.
function startObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(() => {
    if (activeMatch && panelEnabled && !document.getElementById('url-nav-extension')) {
      addNavigationButtons(activeMatch.rule);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// --- keyboard shortcut ----------------------------------------------------

function handleKeydown(e) {
  // Guard: never touch keys (and never preventDefault) on a page where no
  // rule matched. The content script runs on <all_urls>, so without this an
  // enabled shortcut would swallow n / p / arrow keys on every site.
  if (!activeMatch) return;

  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

  if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    navigate(1);
  } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    navigate(-1);
  }
}

// The keydown listener is attached only when the shortcut is enabled AND a
// rule matches this page - so pages with no matching rule pay nothing and
// their keys are never intercepted.
function refreshShortcutState() {
  const shouldAttach = shortcutsEnabled && !!activeMatch;
  if (shouldAttach && !keydownAttached) {
    document.addEventListener('keydown', handleKeydown);
    keydownAttached = true;
  } else if (!shouldAttach && keydownAttached) {
    document.removeEventListener('keydown', handleKeydown);
    keydownAttached = false;
  }
}

function setShortcutsEnabled(enabled) {
  shortcutsEnabled = !!enabled;
  refreshShortcutState();
}

// --- bootstrap ----------------------------------------------------------

function init() {
  getSettings((rules, enabled, showPanel) => {
    activeMatch = findMatchingRule(window.location.href, rules);
    panelEnabled = showPanel;
    refreshPanel();
    setShortcutsEnabled(enabled);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Live-update when the popup/options page changes settings.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.shortcutsEnabled) {
    setShortcutsEnabled(!!changes.shortcutsEnabled.newValue);
  }
  if (changes.showPanel) {
    panelEnabled = changes.showPanel.newValue !== false;
    refreshPanel();
  }
  if (changes.rules) {
    removeNavigationButtons();
    activeMatch = null;
    stopObserver();
    init();
  }
});

// Triggered by the background service worker when the declared
// chrome://extensions/shortcuts command fires.
chrome.runtime.onMessage.addListener((message) => {
  if (!message) return;
  if (message.action === 'go-next') navigate(1);
  if (message.action === 'go-prev') navigate(-1);
});
