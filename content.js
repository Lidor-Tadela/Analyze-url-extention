// Content script to handle URL modification
function incrementChapterInUrl() {
  const currentUrl = window.location.href;

  // Match pattern: https://toonily.com/serie/[series-name]/chapter-[number]
  const chapterRegex = /\/chapter-(\d+)(?:\/)?$/;
  const match = currentUrl.match(chapterRegex);

  if (match) {
    const currentChapter = parseInt(match[1]);
    const nextChapter = currentChapter + 1;

    // Create new URL with incremented chapter
    const newUrl = currentUrl.replace(chapterRegex, `/chapter-${nextChapter}/`);

    return newUrl;
  }

  return null;
}

// Add navigation buttons to the page
function addNavigationButtons() {
  // Check if buttons already exist
  if (document.getElementById('chapter-nav-extension')) {
    return;
  }

  const navContainer = document.createElement('div');
  navContainer.id = 'chapter-nav-extension';
  navContainer.style.cssText = `
    position: fixed;
    top: 50%;
    right: 20px;
    transform: translateY(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Next chapter button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Chapter';
  nextBtn.style.cssText = `
    padding: 10px 15px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.3s;
  `;

  nextBtn.addEventListener('mouseenter', () => {
    nextBtn.style.background = '#45a049';
  });

  nextBtn.addEventListener('mouseleave', () => {
    nextBtn.style.background = '#4CAF50';
  });

  nextBtn.addEventListener('click', () => {
    const nextUrl = incrementChapterInUrl();
    if (nextUrl) {
      window.location.href = nextUrl;
    }
  });

  // Previous chapter button
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Prev Chapter';
  prevBtn.style.cssText = `
    padding: 10px 15px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.3s;
  `;

  prevBtn.addEventListener('mouseenter', () => {
    prevBtn.style.background = '#1976D2';
  });

  prevBtn.addEventListener('mouseleave', () => {
    prevBtn.style.background = '#2196F3';
  });

  prevBtn.addEventListener('click', () => {
    const currentUrl = window.location.href;
    const chapterRegex = /\/chapter-(\d+)(?:\/)?$/;
    const match = currentUrl.match(chapterRegex);

    if (match) {
      const currentChapter = parseInt(match[1]);
      if (currentChapter > 1) {
        const prevChapter = currentChapter - 1;
        const prevUrl = currentUrl.replace(chapterRegex, `/chapter-${prevChapter}/`);
        window.location.href = prevUrl;
      }
    }
  });

  navContainer.appendChild(nextBtn);
  navContainer.appendChild(prevBtn);
  document.body.appendChild(navContainer);
}

// Add keyboard shortcuts
function addKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Right arrow or 'n' for next chapter
    if (e.key === 'ArrowRight' || e.key === 'n') {
      e.preventDefault();
      const nextUrl = incrementChapterInUrl();
      if (nextUrl) {
        window.location.href = nextUrl;
      }
    }

    // Left arrow or 'p' for previous chapter
    if (e.key === 'ArrowLeft' || e.key === 'p') {
      e.preventDefault();
      const currentUrl = window.location.href;
      const chapterRegex = /\/chapter-(\d+)(?:\/)?$/;
      const match = currentUrl.match(chapterRegex);

      if (match) {
        const currentChapter = parseInt(match[1]);
        if (currentChapter > 1) {
          const prevChapter = currentChapter - 1;
          const prevUrl = currentUrl.replace(chapterRegex, `/chapter-${prevChapter}/`);
          window.location.href = prevUrl;
        }
      }
    }
  });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    addNavigationButtons();
    addKeyboardShortcuts();
  });
} else {
  addNavigationButtons();
  addKeyboardShortcuts();
}

// Re-add buttons if page content changes (for dynamic sites)
const observer = new MutationObserver(() => {
  if (!document.getElementById('chapter-nav-extension')) {
    addNavigationButtons();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});