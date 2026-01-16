import { SubtitlePanel } from './ui/panel';
import { KeyboardHandler } from './keyboard';
import { SELECTORS } from './constants';
import './ui/styles.css';

console.log('[Subtitle Loop] Content script loaded');

let panel: SubtitlePanel | null = null;
let keyboardHandler: KeyboardHandler | null = null;

/**
 * Check if current page is a YouTube video page
 */
function isVideoPage(): boolean {
  return (
    window.location.pathname === '/watch' &&
    new URLSearchParams(window.location.search).has('v')
  );
}

/**
 * Initialize or update panel based on current page
 */
function initializePanel(): void {
  if (!isVideoPage()) {
    // Not a video page - destroy panel if exists
    if (panel) {
      panel.destroy();
      panel = null;
    }
    if (keyboardHandler) {
      keyboardHandler.destroy();
      keyboardHandler = null;
    }
    console.log('[Subtitle Loop] Panel destroyed (not video page)');
    return;
  }

  // Wait for YouTube to finish loading
  waitForElement(SELECTORS.secondaryColumn)
    .then(async () => {
      if (!panel) {
        panel = new SubtitlePanel();
      }
      panel.create();

      // Initialize keyboard shortcuts
      if (!keyboardHandler && panel) {
        keyboardHandler = new KeyboardHandler({
          setLoopStart: () => panel?.handleLoopStartShortcut(),
          setLoopEnd: () => panel?.handleLoopEndShortcut(),
          saveSegment: () => panel?.handleSaveShortcut(),
          clearLoop: () => panel?.handleClearLoopShortcut(),
          refreshSubtitles: () => panel?.handleRefreshShortcut(),
        });
        console.log('[Subtitle Loop] Keyboard shortcuts enabled');
      }

      // Check for pending loop from library
      await panel.checkPendingLoop();

      console.log('[Subtitle Loop] Panel initialized');
    })
    .catch(() => {
      console.warn('[Subtitle Loop] Could not find insertion point');
    });
}

/**
 * Wait for an element to appear in DOM
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

/**
 * Set up navigation detection for YouTube SPA
 */
function setupNavigationListener(): void {
  // YouTube fires this custom event on navigation
  document.addEventListener('yt-navigate-finish', () => {
    console.log('[Subtitle Loop] Navigation detected');
    // Small delay to let YouTube update the DOM
    setTimeout(initializePanel, 500);
  });

  // Also handle popstate for browser back/forward
  window.addEventListener('popstate', () => {
    setTimeout(initializePanel, 500);
  });
}

// Initialize on load
setupNavigationListener();
initializePanel();
