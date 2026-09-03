# Next Part Navigator

A Chrome extension (Manifest V3) for people who read manga/comics or watch
shows/anime online and want to jump to the next chapter or episode without
hunting for the site's own "next" button (and the ads around it).

It ships with one working example site (Toonily) but isn't hardcoded to it —
navigation is driven by a small **rule system**, and you add rules for new
sites without writing anything: open a chapter/episode page, click the number
in its address, done.

## Adding a site (no regex)

1. Open a chapter/episode page, e.g.
   `https://toonily.com/serie/some-series/chapter-5/`.
2. Click the extension's toolbar icon → **"Set up navigation for this page"**.
3. Then either:
   - **The site has its own Prev/Next chapter buttons** (most manga sites do):
     the popup says so and just asks for a button label. Saving makes a rule
     that *follows those links* — which means side-stories and half-chapters
     (`chapter-175-8`, `chapter-175-8_1`, …) work, not just clean numbers.
   - **No site buttons:** the address is shown with every number as a button.
     Click the one that changes between parts; it shows a live
     `Next → …/chapter-6/` preview. Leave **"Also match other series / shows
     on this site"** ticked to cover the whole site.
4. **Save.** The Next/Prev panel appears immediately.

Manage, toggle, or delete rules — or hand-write one — on the **Options** page.

## How rules work

A rule navigates one of two ways:

1. **Follow the page's own Prev/Next links.** If the rule has a CSS selector
   for the site's next/previous chapter link, the extension clicks through
   that. This is the only thing that copes with non-numeric sequences
   (side-stories, `175.8`, `_1`/`_2` parts). Recognised automatically for
   sites built on the common WordPress "Madara" manga theme.
2. **Step a number in the URL.** A regular expression with **exactly one
   capturing group** around the number; "Next"/"Previous" replace just that
   span (zero-padding like `chapter-007` is preserved) and leave the rest of
   the URL untouched.

The URL-number mechanism covers any shape:

| Shape | Example pattern |
|---|---|
| `site.com/thing/chapter-N` | `^https://toonily\.com/serie/[^/]+/chapter-(\d+)/?$` |
| `site.com/thing/episode/N` | `^https://example\.com/show/[^/]+/episode/(\d+)/?$` |
| `site.com/thing/N` | `^https://example\.com/manga/[^/]+/(\d+)/?$` |
| number embedded mid-slug | `^https://example\.com/watch/(\d+)-[^/]+$` |

"Next"/"Previous" replace only the numeric span the capturing group matched
(zero-padding, e.g. `chapter-007`, is preserved), leaving the rest of the
URL untouched - so it works regardless of where in the URL the number sits.

Manage rules at the extension's **Options** page: enable/disable built-ins,
delete custom ones, or add one by hand (with a "Test pattern" preview against
a real URL before saving) if the click-the-number flow guessed wrong. Rules
sync via `chrome.storage.sync`.

## Using it on a page

When the current URL matches an enabled rule, a floating Next/Prev button
panel appears on the page, and the toolbar popup shows which rule matched
with its own Next/Prev buttons.

If the on-page panel gets in the way, turn it off with **"Show buttons on
the page"** in the popup (or Options), or click the small **×** on the panel
itself. Navigation still works from the popup and the keyboard shortcut.

## Keyboard shortcut (optional, toggle-able)

Two ways to jump to the next/previous part without touching the mouse, both
gated by a single "Keyboard shortcut" toggle (in the popup or the options
page):

- **Page keys** (need the page focused, won't fire while typing in an
  input): → or N for next, ← or P for previous.
- **Global command** (works without clicking the page first, rebindable at
  `chrome://extensions/shortcuts`): defaults to Alt+Shift+Right /
  Alt+Shift+Left.

## Installing (unpacked)

1. `chrome://extensions` → enable Developer mode.
2. "Load unpacked" → select this folder.
3. Visit a matching page, or add a rule for your own site in Options.

## Notes on permissions

The extension requests `<all_urls>` host access so it can work on whatever
site you configure a rule for, without you having to edit the manifest and
reload the extension every time you add one. It only actually does anything
(reads the URL, injects buttons) on pages that match an enabled rule.
