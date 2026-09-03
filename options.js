// Options page: list/enable/delete rules, add a new custom rule (with a
// "Test pattern" preview before saving), and toggle the keyboard shortcut.

function loadRules(cb) {
  chrome.storage.sync.get({ rules: null }, ({ rules }) => {
    cb(rules && rules.length ? rules : DEFAULT_RULES.map((r) => ({ ...r })));
  });
}

function saveRules(rules) {
  chrome.storage.sync.set({ rules });
}

function renderRules(rules) {
  const tbody = document.getElementById('rulesBody');
  tbody.innerHTML = '';
  rules.forEach((rule, i) => {
    const tr = document.createElement('tr');

    const enabledTd = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!rule.enabled;
    cb.addEventListener('change', () => {
      rules[i].enabled = cb.checked;
      saveRules(rules);
    });
    enabledTd.appendChild(cb);

    const nameTd = document.createElement('td');
    nameTd.textContent = rule.name + (rule.builtIn ? ' (built-in)' : '');

    const patternTd = document.createElement('td');
    const codeEl = document.createElement('code');
    codeEl.textContent = rule.pattern;
    patternTd.appendChild(codeEl);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'row-actions';
    if (!rule.builtIn) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        rules.splice(i, 1);
        saveRules(rules);
        renderRules(rules);
      });
      actionsTd.appendChild(delBtn);
    }

    tr.append(enabledTd, nameTd, patternTd, actionsTd);
    tbody.appendChild(tr);
  });
}

function validatePattern(pattern) {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch (e) {
    return `Invalid regex: ${e.message}`;
  }
  const groupCount = countGroups(pattern);
  if (groupCount !== 1) {
    return `Pattern must have exactly one capturing group around the number (found ${groupCount < 0 ? 'an invalid pattern' : groupCount}). Use (?:...) for any other group.`;
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  let rules = [];
  loadRules((loaded) => {
    rules = loaded;
    renderRules(rules);
  });

  chrome.storage.sync.get({ shortcutsEnabled: true, showPanel: true }, ({ shortcutsEnabled, showPanel }) => {
    document.getElementById('shortcutsToggle').checked = !!shortcutsEnabled;
    document.getElementById('panelToggle').checked = showPanel !== false;
  });
  document.getElementById('shortcutsToggle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ shortcutsEnabled: e.target.checked });
  });
  document.getElementById('panelToggle').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showPanel: e.target.checked });
  });

  const errorEl = document.getElementById('formError');
  const setError = (msg, ok) => {
    errorEl.textContent = msg;
    errorEl.style.color = ok ? '#2e7d32' : '#c62828';
  };

  document.getElementById('testBtn').addEventListener('click', () => {
    const pattern = document.getElementById('rulePattern').value.trim();
    const testUrl = document.getElementById('testUrl').value.trim();
    if (!pattern) return setError('Enter a pattern first.', false);
    if (!testUrl) return setError('Enter a test URL to try the pattern against.', false);

    const err = validatePattern(pattern);
    if (err) return setError(err, false);

    const fakeRule = { pattern, enabled: true, min: 0 };
    const found = findMatchingRule(testUrl, [fakeRule]);
    if (!found) return setError('No match against that URL.', false);

    const next = computeAdjacentUrl(testUrl, fakeRule, 1);
    setError(next ? `Match OK. Next would be: ${next}` : 'Matched, but could not compute the next URL.', !!next);
  });

  document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('ruleName').value.trim();
    const label = document.getElementById('ruleLabel').value.trim() || 'Part';
    const pattern = document.getElementById('rulePattern').value.trim();

    if (!name || !pattern) return setError('Name and pattern are required.', false);
    const err = validatePattern(pattern);
    if (err) return setError(err, false);

    rules.push({
      id: 'custom-' + Date.now(),
      name,
      label,
      pattern,
      enabled: true,
      builtIn: false,
      min: 0
    });
    saveRules(rules);
    renderRules(rules);
    setError('Rule added.', true);
    e.target.reset();
    document.getElementById('ruleLabel').value = 'Part';
  });
});
