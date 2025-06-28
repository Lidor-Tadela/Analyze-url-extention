// Popup script for the extension
document.addEventListener('DOMContentLoaded', () => {
  const nextBtn = document.getElementById('nextChapter');
  const prevBtn = document.getElementById('prevChapter');

  // Function to execute script in the active tab
  async function executeInActiveTab(func) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('toonily.com/serie/') || !tab.url.includes('/chapter-')) {
        alert('This extension only works on Toonily chapter pages!');
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: func
      });

      // Close popup after action
      window.close();
    } catch (error) {
      console.error('Error executing script:', error);
    }
  }

  // Next chapter function
  function goToNextChapter() {
    const currentUrl = window.location.href;
    const chapterRegex = /\/chapter-(\d+)(?:\/)?$/;
    const match = currentUrl.match(chapterRegex);

    if (match) {
      const currentChapter = parseInt(match[1]);
      const nextChapter = currentChapter + 1;
      const newUrl = currentUrl.replace(chapterRegex, `/chapter-${nextChapter}/`);
      window.location.href = newUrl;
    }
  }

  // Previous chapter function
  function goToPrevChapter() {
    const currentUrl = window.location.href;
    const chapterRegex = /\/chapter-(\d+)(?:\/)?$/;
    const match = currentUrl.match(chapterRegex);

    if (match) {
      const currentChapter = parseInt(match[1]);
      if (currentChapter > 1) {
        const prevChapter = currentChapter - 1;
        const newUrl = currentUrl.replace(chapterRegex, `/chapter-${prevChapter}/`);
        window.location.href = newUrl;
      }
    }
  }

  // Event listeners
  nextBtn.addEventListener('click', () => {
    executeInActiveTab(goToNextChapter);
  });

  prevBtn.addEventListener('click', () => {
    executeInActiveTab(goToPrevChapter);
  });
});