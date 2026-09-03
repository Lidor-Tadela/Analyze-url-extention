// Popup script.
//
// Rule already matches the tab -> show Next/Prev (the content script owns
// the matched rule and does the navigation).
//
// No rule yet -> "set up this page":
//   * if the page has its own Prev/Next chapter links, offer to follow them
//     (handles side-stories / half-chapters that URL math can't)
//   * otherwise, click the number in the URL that changes between parts

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const nextBtn = $('nextBtn');
  const prevBtn = $('prevBtn');
  const setupBtn = $('setupBtn');
  const setup = $('setup');
  const siteNavPane = $('siteNavPane');
  const siteNavLabel = $('siteNavLabel');
  const siteNavSaveBtn = $('siteNavSaveBtn');
  const siteNavCancelBtn = $('siteNavCancelBtn');
  const useNumbersLink = $('useNumbersLink');
  const numberPane = $('numberPane');
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
  let pendingSiteNav = null;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    activeTabId = tab.id;
    pageUrl = tab.url || '';

    chrome.storage.sync.get({ rules: null }, ({ rules }) => {
      const stored = rules && rules.length ? rules : DEFAULT_RULES.map((r) => ({ ...r }));
      ruleSet = migrateRules(stored);
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

  function guessLabelForPage() {
    const spans = findNumberSpans(pageUrl);
    return spans.length ? guessLabel(pageUrl, spans[0].start) : 'Chapter';
  }

  function resetSetup() {
    setup.hidden = true;
    siteNavPane.hidden = true;
    numberPane.hidden = true;
    setupDetails.hidden = true;
    setupBtn.hidden = false;
    pickedSpan = null;
    pendingSiteNav = null;
  }

  setupBtn.addEventListener('click', () => {
    setupBtn.hidden = true;
    setup.hidden = false;
    // Ask the content script whether the page has its own Prev/Next links.
    if (activeTabId == null) return showNumberPane();
    chrome.tabs.sendMessage(activeTabId, { action: 'detect-site-nav' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.siteNav) return showNumberPane();
      showSiteNavPane(resp.siteNav);
    });
  });

  siteNavCancelBtn.addEventListener('click', resetSetup);
  cancelBtn.addEventListener('click', resetSetup);
  useNumbersLink.addEventListener('click', showNumberPane);

  function showSiteNavPane(siteNav) {
    pendingSiteNav = siteNav;
    numberPane.hidden = true;
    siteNavPane.hidden = false;
    siteNavLabel.value = guessLabelForPage();
  }

  siteNavSaveBtn.addEventListener('click', () => {
    if (!pendingSiteNav) return;
    const rule = buildSelectorRule(pageUrl, {
      label: siteNavLabel.value.trim() || 'Chapter',
      name: guessName(pageUrl),
      nextSelector: pendingSiteNav.nextSelector,
      prevSelector: pendingSiteNav.prevSelector
    });
    if (!rule) return showNumberPane();
    ruleSet.push(rule);
    chrome.storage.sync.set({ rules: ruleSet }, () => window.close());
  });

  function showNumberPane() {
    pendingSiteNav = null;
    siteNavPane.hidden = true;
    numberPane.hidden = false;
    renderPicker();
  }

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
