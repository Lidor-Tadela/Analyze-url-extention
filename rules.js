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

// A rule can navigate two ways:
//   1. Follow the page's own Prev/Next links  (nextSelector / prevSelector)
//   2. Step a number in the URL               (pattern with one capture group)
// (1) wins when present - it's the only thing that copes with side-stories
// and odd numbering (e.g. chapter-175 -> chapter-175-5 -> ... -> chapter-175-8
// -> chapter-175-8_1). (2) is the fallback.

// Reader/chapter Prev-Next link selectors, most specific first. Used to
// auto-detect a site's own navigation during rule setup, and as a safety
// net at navigation time.
const KNOWN_NAV = [
  { next: '.btn.next_page', prev: '.btn.prev_page' },             // "Madara" WordPress manga theme
  { next: 'a.next_page', prev: 'a.prev_page' },
  { next: '.nav-next a', prev: '.nav-previous a' },               // WordPress
  { next: 'a.next-chapter, a.next_chapter', prev: 'a.prev-chapter, a.prev_chapter' },
  { next: '.select-pagination .nav-next a', prev: '.select-pagination .nav-prev a' }
];

// Both built-ins ship DISABLED, as templates. Add rules for the sites you
// actually use with "Set up navigation for this page" in the popup - it
// writes the rule for you (and detects a site's own Prev/Next links).
const DEFAULT_RULES = [
  {
    // Type 1: follow the page's own Prev/Next links. These selectors work
    // as-is on any site built with the common "Madara" WordPress manga theme.
    id: 'builtin-example-linknav',
    name: 'Example: site with its own Prev/Next chapter buttons',
    label: 'Chapter',
    enabled: false,
    builtIn: true,
    pattern: '^https://manga\\.example/[^/]+/[^/]+/chapter-([\\w.-]+)/?$',
    nextSelector: '.btn.next_page',
    prevSelector: '.btn.prev_page',
    min: 0
  },
  {
    // Type 2: step a number in the URL.
    id: 'builtin-example-episode',
    name: 'Example: site/show/<name>/episode/N',
    label: 'Episode',
    enabled: false,
    builtIn: true,
    pattern: '^https://shows\\.example/show/[^/]+/episode/(\\d+)/?$',
    min: 1
  }
];

// Hook for one-time upgrades of rules loaded from storage. Currently a
// no-op; returns its argument unchanged.
function migrateRules(rules) {
  return rules;
}

// Resolve an href against a base and return it only if same-origin and not
// a link to the current page. Null otherwise.
function sameOriginHref(href, baseUrl) {
  if (!href) return null;
  try {
    const u = new URL(href, baseUrl);
    const base = new URL(baseUrl);
    if (u.origin !== base.origin) return null;
    if (u.href === base.href) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

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
  if (!/^\d+$/.test(numStr)) return null; // capture isn't a plain integer - can't step it
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;

  const next = num + delta;
  const min = typeof rule.min === 'number' ? rule.min : 0;
  if (next < min) return null;

  const nextStr = String(next).padStart(numStr.length, '0');
  return url.slice(0, start) + nextStr + url.slice(end);
}

// ---------------------------------------------------------------------------
// Learn-a-rule-from-the-current-page
//
// The user never writes a regex. They open a page whose URL contains the
// chapter/episode number, click that number, and buildRuleFromExample turns
// the whole URL into a pattern: fixed parts are escaped literally, the
// clicked number becomes the (\d+) capture group, and (optionally) the
// series/show slug earlier in the path is generalised to [^/]+ so the rule
// also works on other series on the same site.
// ---------------------------------------------------------------------------

function escapeRegexLiteral(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Every run of digits in the URL, as { start, end, value } - drives the
// "click the number" UI in the popup.
function findNumberSpans(url) {
  const spans = [];
  const re = /\d+/g;
  let m;
  while ((m = re.exec(url)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }
  return spans;
}

// Guess a button label from the text right before the number
// ("chapter-5" -> "Chapter", ".../episode/5" -> "Episode").
function guessLabel(url, numStart) {
  const before = url.slice(0, numStart);
  const m = before.match(/([A-Za-z]{2,})[^A-Za-z]*$/);
  if (!m) return 'Part';
  const w = m[1].toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Guess a rule name from the host ("www.mangahost.example" -> "Mangahost").
function guessName(url) {
  const m = url.match(/^[a-z]+:\/\/([^/]+)/i);
  if (!m) return 'Custom site';
  const host = m[1].replace(/^www\./i, '');
  const first = host.split('.')[0] || host;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// Category/section words - not a series name, so don't generalise one of
// these to [^/]+ even when it sits right before the number.
const NAV_WORD = /^(chapter|chapters|ch|episode|episodes|ep|part|parts|vol|volume|page|pages|read|reader|view|viewer|watch|webtoon|webtoons|comic|comics|manga|manhwa|manhua|toon|toons|series|serie|title|show|shows|season|seasons)$/i;

// Build a rule pattern from a real URL plus the { start, end } span of the
// digit run the user picked. `generalizeSlugs` (default true) turns
// slug-like path segments before the number into [^/]+.
// Returns null if the number sits in the query string / fragment.
function buildPatternFromExample(url, span, options) {
  const generalizeSlugs = !options || options.generalizeSlugs !== false;
  const numStart = span.start;
  const numEnd = span.end;

  const tailIx = url.search(/[?#]/);
  const core = tailIx === -1 ? url : url.slice(0, tailIx);
  if (numEnd > core.length) return null; // number was in ?query or #hash

  let prefix = core.slice(0, numStart);
  const suffix = core.slice(numEnd);

  const originMatch = prefix.match(/^([a-z]+:\/\/[^/]+)(\/.*)?$/i);
  if (generalizeSlugs && originMatch) {
    const origin = originMatch[1];
    const path = originMatch[2] || '';
    const parts = path.split('/'); // leading '' for the leading slash

    const isSlug = (seg, i) => {
      if (!seg) return false;
      const slugPosition = i === parts.length - 2; // segment right before the number
      return (
        /-/.test(seg) ||
        (/[A-Za-z]/.test(seg) && seg.length >= 12) ||
        (slugPosition && /[A-Za-z]/.test(seg) && seg.length >= 3 && !NAV_WORD.test(seg))
      );
    };

    // The last element stays literal - it's the text immediately before the
    // number (e.g. "chapter-"); slug-like earlier segments become [^/]+.
    const rebuilt = parts
      .map((seg, i) => (i < parts.length - 1 && isSlug(seg, i) ? '[^/]+' : escapeRegexLiteral(seg)))
      .join('/');
    prefix = escapeRegexLiteral(origin) + rebuilt;
  } else {
    prefix = escapeRegexLiteral(prefix);
  }

  const suffixPat = suffix === '' || suffix === '/' ? '/?' : escapeRegexLiteral(suffix);
  return '^' + prefix + '(\\d+)' + suffixPat + '(?:[?#].*)?$';
}

// One call for the popup: given the page URL and which number span was
// clicked, return a ready-to-save rule with the guessed label/name.
function buildRuleFromExample(url, span, options) {
  const opts = options || {};
  const pattern = buildPatternFromExample(url, span, opts);
  if (!pattern) return null;
  if (countGroups(pattern) !== 1) return null;

  const rule = {
    id: 'custom-' + Date.now(),
    name: opts.name || guessName(url),
    label: opts.label || guessLabel(url, span.start),
    pattern,
    enabled: true,
    builtIn: false,
    min: typeof opts.min === 'number' ? opts.min : 1
  };

  // Sanity-check the generated rule against the very URL it came from.
  if (!findMatchingRule(url, [rule])) return null;
  return rule;
}

// Build a rule that navigates by following the page's own Prev/Next links.
// The pattern just decides which pages the rule applies to: fixed parts of
// the URL stay literal, slug-like segments become [^/]+, and the final path
// segment's identifier becomes a loose (.+?) capture (so chapter-175,
// chapter-175-8 and chapter-175-8_1 all match the one rule).
function buildSelectorRule(url, options) {
  const opts = options || {};
  const tailIx = url.search(/[?#]/);
  const core = tailIx === -1 ? url : url.slice(0, tailIx);

  const originMatch = core.match(/^([a-z]+:\/\/[^/]+)(\/.*)?$/i);
  if (!originMatch) return null;
  const origin = originMatch[1];
  const path = (originMatch[2] || '').replace(/\/+$/, '');
  const parts = path.split('/'); // ['', seg1, ..., lastSeg]
  if (parts.length < 2 || !parts[parts.length - 1]) return null;

  const lastSeg = parts[parts.length - 1];
  const mid = parts
    .slice(0, -1)
    .map((seg) => {
      if (!seg) return seg;
      const slugLike = /-/.test(seg) || (/[A-Za-z]/.test(seg) && seg.length >= 12);
      return slugLike ? '[^/]+' : escapeRegexLiteral(seg);
    })
    .join('/');

  const litPrefix = (lastSeg.match(/^\D*/) || [''])[0]; // "chapter-" from "chapter-175-8_1"
  const lastPat = escapeRegexLiteral(litPrefix) + '(.+?)';
  const pattern = '^' + escapeRegexLiteral(origin) + mid + '/' + lastPat + '/?(?:[?#].*)?$';
  if (countGroups(pattern) !== 1) return null;

  const lastSegStart = core.replace(/\/+$/, '').lastIndexOf('/') + 1;
  const rule = {
    id: 'custom-' + Date.now(),
    name: opts.name || guessName(url),
    label: opts.label || guessLabel(core, lastSegStart + litPrefix.length),
    pattern,
    enabled: true,
    builtIn: false,
    nextSelector: opts.nextSelector || null,
    prevSelector: opts.prevSelector || null,
    min: 0
  };
  if (!findMatchingRule(url, [rule])) return null;
  return rule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_RULES,
    KNOWN_NAV,
    findMatchingRule,
    computeAdjacentUrl,
    compileRule,
    countGroups,
    migrateRules,
    sameOriginHref,
    findNumberSpans,
    buildPatternFromExample,
    buildRuleFromExample,
    buildSelectorRule,
    guessLabel,
    guessName
  };
}
