# Next Part Navigator

A Chrome extension (Manifest V3) for people who read manga/comics or watch
shows/anime online and want to jump to the next chapter or episode without
hunting for the site's own "next" button (and the ads around it).

It ships with one working example site (Toonily) but isn't hardcoded to it —
navigation is driven by a small **rule system**, configurable from the
extension's options page, so it can be pointed at any site that encodes a
chapter/episode number in its URL.

## How it works

A rule is a regular expression tested against the full page URL. It must
contain **exactly one capturing group**, wrapped around the number to
step through. That single mechanism covers any URL shape:

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
add your own (with a "Test pattern" preview against a real URL before
saving), or delete custom ones. Rules sync via `chrome.storage.sync`.

## Using it on a page

When the current URL matches an enabled rule, a floating Next/Prev button
panel appears on the page, and the toolbar popup shows which rule matched
with its own Next/Prev buttons.

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
