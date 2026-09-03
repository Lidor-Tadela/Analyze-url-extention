# Next Part Navigator

A Chrome extension (Manifest V3) for people who read manga/comics or watch
shows/anime online and want to jump to the next chapter or episode without
hunting for the site's own "next" button (and the ads around it).

It ships with one working example site (Toonily) but isn't hardcoded to it —
navigation is driven by a small **rule system**, and you add rules for new
sites without writing anything: open a chapter/episode page, click the number
in its address, done.

## Adding a site (no regex)

1. Open a page whose URL contains the chapter/episode number, e.g.
   `https://toonily.com/serie/some-series/chapter-5/`.
2. Click the extension's toolbar icon → **"Set up navigation for this page"**.
3. The address is shown with every number as a button. Click the one that
   changes between parts (the `5`).
4. It fills in the button label ("Chapter") and shows a live preview —
   `Next → …/chapter-6/`. Leave **"Also match other series / shows on this
   site"** ticked so the rule covers the whole site, not just this one page.
5. **Save.** The Next/Prev panel appears immediately.

Behind the scenes this writes a rule (a regex) for you; you can view, toggle,
or delete rules — and hand-write one — on the **Options** page.

## How rules work

A rule is a regular expression tested against the full page URL, with
**exactly one capturing group** wrapped around the number to step through.
That single mechanism covers any URL shape:

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
