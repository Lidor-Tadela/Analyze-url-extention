// Popup script.
//
// If a rule already matches the current tab: show Next/Prev (navigation is
// done by messaging the content script, which owns the matched rule).
//
// If no rule matches: offer a "set up this page" flow where the user clicks
// the number in the URL that changes between chapters/episodes and the rule
// is generated for them (see buildRuleFromExample in rules.js) - no regex.

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const nextBtn = $('nextBtn');
  const prevBtn = $('prevBtn');
  const setupBtn = $('setupBtn');
  const setup = $('setup');
  const urlPicker = $('urlPicker');
  const setupDetails = $('setupDetails');
  const labelInput = $('labelInput');
  const minInput = $('minInput');
  const generalizeInput = $('generalizeInput');
  const preview = $('preview');
  const saveBtn = $('saveBtn');
  const cancelBtn = $('cancelBtn');
  const toggle = $('shortcutsToggle');
  const panelToggle = $('panelToggle');
  const optionsLink = $('optionsLink');

  let activeTabId = null;
  let pageUrl = '';
  let ruleSet = [];
  let pickedSpan = null;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    activeTabId = tab.id;
    pageUrl = tab.url || '';

    chrome.storage.sync.get({ rules: null }, ({ rules }) => {
      ruleSet = rules && rules.length ? rules : DEFAULT_RULES.map((r) => ({ ...r }));
      const found = findMatchingRule(pageUrl, ruleSet);
      if (found) {
        statusEl.textContent = `Matched: ${found.rule.name}`;
        statusEl.classList.remove('nomatch');
        nextBtn.disabled = false;
        prevBtn.disabled = false;
      } else {
        statusEl.textContent = 'No rule for this page yet.';
        statusEl.classList.add('nomatch');
        setupBtn.hidden = false;
      }
    });
  });

  chrome.storage.sync.get({ shortcutsEnabled: true, showPanel: true }, ({ shortcutsEnabled, showPanel }) => {
    toggle.checked = !!shortcutsEnabled;
    panelToggle.checked = showPanel !== false;
  });
  toggle.addEventListener('change', () => {
    chrome.storage.sync.set({ shortcutsEnabled: toggle.checked });
  });
  panelToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showPanel: panelToggle.checked });
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
  optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // --- "set up this page" flow -------------------------------------------

  setupBtn.addEventListener('click', () => {
    setupBtn.hidden = true;
    setup.hidden = false;
    renderPicker();
  });

  cancelBtn.addEventListener('click', () => {
    setup.hidden = true;
    setupDetails.hidden = true;
    setupBtn.hidden = false;
    pickedSpan = null;
  });

  function renderPicker() {
    urlPicker.textContent = '';
    const spans = findNumberSpans(pageUrl);
    if (!spans.length) {
      urlPicker.textContent = pageUrl + '  — no number found in this URL';
      return;
    }
    let cursor = 0;
    spans.forEach((span) => {
      if (span.start > cursor) {
        urlPicker.appendChild(document.createTextNode(pageUrl.slice(cursor, span.start)));
      }
      const chip = document.createElement('button');
      chip.className = 'numchip';
      chip.textContent = span.value;
      chip.addEventListener('click', () => pickNumber(span, chip));
      urlPicker.appendChild(chip);
      cursor = span.end;
    });
    if (cursor < pageUrl.length) {
      urlPicker.appendChild(document.createTextNode(pageUrl.slice(cursor)));
    }
  }

  function pickNumber(span, chip) {
    pickedSpan = span;
    urlPicker.querySelectorAll('.numchip').forEach((c) => c.classList.remove('picked'));
    chip.classList.add('picked');
    setupDetails.hidden = false;
    labelInput.value = guessLabel(pageUrl, span.start);
    refreshPreview();
  }

  function currentRule() {
    if (!pickedSpan) return null;
    const min = parseInt(minInput.value, 10);
    return buildRuleFromExample(pageUrl, pickedSpan, {
      label: labelInput.value.trim() || 'Part',
      min: isNaN(min) ? 0 : min,
      generalizeSlugs: generalizeInput.checked
    });
  }

  function refreshPreview() {
    const rule = currentRule();
    if (!rule) {
      preview.className = 'preview bad';
      preview.textContent = 'That number can’t be used to build a rule — try a different one.';
      saveBtn.disabled = true;
      return;
    }
    const nextUrl = computeAdjacentUrl(pageUrl, rule, 1);
    const prevUrl = computeAdjacentUrl(pageUrl, rule, -1);
    preview.className = 'preview';
    preview.textContent =
      'Next → ' + (nextUrl || '(n/a)') + '\n' +
      'Prev → ' + (prevUrl || '(none — this is the lowest number)');
    saveBtn.disabled = false;
  }

  labelInput.addEventListener('input', refreshPreview);
  minInput.addEventListener('input', refreshPreview);
  generalizeInput.addEventListener('change', refreshPreview);

  saveBtn.addEventListener('click', () => {
    const rule = currentRule();
    if (!rule) return;
    rule.name = guessName(pageUrl);
    ruleSet.push(rule);
    chrome.storage.sync.set({ rules: ruleSet }, () => {
      // The content script picks this up via chrome.storage.onChanged and
      // injects the Next/Prev panel on the page.
      window.close();
    });
  });
});
