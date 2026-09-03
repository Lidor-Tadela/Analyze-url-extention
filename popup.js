// Popup script: shows whether a rule matches the current tab, and offers
// Next/Prev buttons plus the keyboard-shortcut toggle. Navigation is done
// via a message to the content script (which already has the matched rule
// and does the URL computation), not by injecting a function - this avoids
// duplicating the rule-matching logic here.

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const toggle = document.getElementById('shortcutsToggle');
  const optionsLink = document.getElementById('optionsLink');

  let activeTabId = null;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    activeTabId = tab.id;

    chrome.storage.sync.get({ rules: null }, ({ rules }) => {
      const ruleSet = rules && rules.length ? rules : DEFAULT_RULES;
      const found = findMatchingRule(tab.url || '', ruleSet);
      if (found) {
        statusEl.textContent = `Matched: ${found.rule.name}`;
        statusEl.classList.remove('nomatch');
        nextBtn.disabled = false;
        prevBtn.disabled = false;
      } else {
        statusEl.textContent = 'No rule matches this page. Add one in options.';
        statusEl.classList.add('nomatch');
      }
    });
  });

  chrome.storage.sync.get({ shortcutsEnabled: true }, ({ shortcutsEnabled }) => {
    toggle.checked = !!shortcutsEnabled;
  });

  toggle.addEventListener('change', () => {
    chrome.storage.sync.set({ shortcutsEnabled: toggle.checked });
  });

  function send(action) {
    if (activeTabId == null) return;
    chrome.tabs.sendMessage(activeTabId, { action }, () => {
      void chrome.runtime.lastError;
    });
    window.close();
  }

  nextBtn.addEventListener('click', () => send('go-next'));
  prevBtn.addEventListener('click', () => send('go-prev'));

  optionsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
