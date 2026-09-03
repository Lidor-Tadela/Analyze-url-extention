// Background service worker: relays the extension's declared keyboard
// commands (rebindable at chrome://extensions/shortcuts) to the content
// script on the active tab. This is the "works without clicking the page
// first" shortcut path; content.js's own keydown listener is the
// "always-on while the page has focus" path. Both are gated by the same
// shortcutsEnabled setting.

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'next-part' && command !== 'prev-part') return;

  chrome.storage.sync.get({ shortcutsEnabled: true }, ({ shortcutsEnabled }) => {
    if (!shortcutsEnabled) return;

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || tab.id == null) return;
      chrome.tabs.sendMessage(
        tab.id,
        { action: command === 'next-part' ? 'go-next' : 'go-prev' },
        () => {
          // No content script matched this page (or no rule matched) -
          // ignore the "Receiving end does not exist" error.
          void chrome.runtime.lastError;
        }
      );
    });
  });
});
