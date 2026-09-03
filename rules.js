// Shared rule engine for Next/Previous chapter-episode navigation.
//
// A "rule" matches a page URL and knows how to compute the adjacent
// (next/previous) URL by finding a single number embedded anywhere in the
// URL - not just a trailing one. That one mechanism covers URL shapes like
// site.com/thing/episode/N, site.com/thing/N, or a number embedded mid-slug
// (site.com/watch/12-title) - the shape doesn't need special-casing, only
// the regex differs per site.
//
// Contract: `pattern` is tested against the full URL and must contain
// exactly one capturing group, wrapped around the number. Everything else
// in the URL is preserved untouched when stepping to an adjacent page.

const DEFAULT_RULES = [
  {
    id: 'builtin-toonily-chapter',
    name: 'Toonily (chapter)',
    label: 'Chapter',
    enabled: true,
    builtIn: true,
    pattern: '^https://toonily\\.com/serie/[^/]+/chapter-(\\d+)/?$',
    min: 1
  },
  {
    id: 'builtin-example-episode',
    name: 'Example: site.com/show/episode/N (edit me)',
    label: 'Episode',
    enabled: false,
    builtIn: true,
    pattern: '^https://example\\.com/show/[^/]+/episode/(\\d+)/?$',
    min: 1
  }
];

// Counts capturing groups in a pattern without needing a matching string:
// appending "|" adds an empty alternative that always matches "", and the
// resulting exec array length is (group count + 1) regardless of which
// branch actually matched.
function countGroups(pattern) {
  try {
    const re = new RegExp(pattern + '|');
    return re.exec('').length - 1;
  } catch (e) {
    return -1;
  }
}

function compileRule(rule) {
  try {
    return new RegExp(rule.pattern, 'd');
  } catch (e) {
    return null;
  }
}

function findMatchingRule(url, rules) {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const re = compileRule(rule);
    if (!re) continue;
    const m = re.exec(url);
    if (m && m.indices && m.indices[1]) {
      return { rule, match: m };
    }
  }
  return null;
}

function computeAdjacentUrl(url, rule, delta) {
  const re = compileRule(rule);
  if (!re) return null;
  const m = re.exec(url);
  if (!m || !m.indices || !m.indices[1]) return null;

  const [start, end] = m.indices[1];
  const numStr = m[1];
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;

  const next = num + delta;
  const min = typeof rule.min === 'number' ? rule.min : 0;
  if (next < min) return null;

  const nextStr = String(next).padStart(numStr.length, '0');
  return url.slice(0, start) + nextStr + url.slice(end);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_RULES, findMatchingRule, computeAdjacentUrl, compileRule, countGroups };
}
