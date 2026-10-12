/**
 * Netflix Dual Subtitles - Content Script
 * Intercepts Netflix Japanese subtitles, attaches Furigana, and overlays Korean translations.
 */

(function () {
  'use strict';

  // Current settings cache
  let settings = {
    enabled: true,
    showFurigana: true,
    subPosition: 'ja-top',
    fontSize: 22,
    furiganaRatio: 55,
    textColor: '#ffffff',
    furiganaColor: '#ffea00',
    bgEnabled: true,
    bgOpacity: 65
  };

  // Local fast cache for translations (text -> koreanTranslation)
  const localTranslationCache = new Map();

  let overlayContainer = null;
  let subtitleBox = null;
  let timedTextObserver = null;
  let playerCheckInterval = null;
  let currentRawText = '';

  /**
   * Loads initial settings from chrome storage
   */
  async function loadSettings() {
    try {
      const data = await chrome.storage.sync.get(null);
      settings = { ...settings, ...data };
      applySettings();
    } catch (err) {
      console.warn('[Netflix Dual Sub] Could not load settings:', err);
    }
  }

  /**
   * Listen for real-time settings changes from popup
   */
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
      applySettings();
      // Re-render current subtitle if visible
      if (currentRawText) {
        renderSubtitles(currentRawText, localTranslationCache.get(currentRawText) || '');
      }
    }
  });

  /**
   * Applies styles and active states based on settings
   */
  function applySettings() {
    if (settings.enabled) {
      document.body.classList.add('nds-active');
    } else {
      document.body.classList.remove('nds-active');
      clearSubtitles();
      return;
    }

    if (!overlayContainer) return;

    // Apply CSS variables for dynamic customization
    overlayContainer.style.setProperty('--nds-text-color', settings.textColor);
    overlayContainer.style.setProperty('--nds-furigana-color', settings.furiganaColor);
    overlayContainer.style.setProperty('--nds-furigana-ratio', `${settings.furiganaRatio / 100}em`);

    if (subtitleBox) {
      subtitleBox.style.fontSize = `${settings.fontSize}px`;
      if (settings.bgEnabled) {
        const alpha = Math.max(0, Math.min(100, settings.bgOpacity)) / 100;
        subtitleBox.style.backgroundColor = `rgba(0, 0, 0, ${alpha})`;
      } else {
        subtitleBox.style.backgroundColor = 'transparent';
      }
    }
  }

  /**
   * Finds the best container inside the Netflix player to inject our overlay
   */
  function findVideoContainer() {
    return (
      document.querySelector('.watch-video') ||
      document.querySelector('[data-uia="watch-video"]') ||
      document.querySelector('.VideoContainer') ||
      document.querySelector('video')?.parentElement
    );
  }

  /**
   * Ensures our dual subtitle overlay DOM exists
   */
  function ensureOverlay() {
    if (overlayContainer && document.body.contains(overlayContainer)) {
      return overlayContainer;
    }

    const container = findVideoContainer();
    if (!container) return null;

    overlayContainer = document.createElement('div');
    overlayContainer.id = 'netflix-dual-subs-overlay';

    subtitleBox = document.createElement('div');
    subtitleBox.className = 'nds-box';
    subtitleBox.style.display = 'none'; // Initially hidden

    overlayContainer.appendChild(subtitleBox);
    container.appendChild(overlayContainer);

    applySettings();
    return overlayContainer;
  }

  /**
   * Clears the current subtitle display
   */
  function clearSubtitles() {
    currentRawText = '';
    if (subtitleBox) {
      subtitleBox.innerHTML = '';
      subtitleBox.style.display = 'none';
    }
  }

  /**
   * Renders dual subtitles (Japanese + Furigana & Korean)
   * @param {string} jaRaw - Raw Japanese text
   * @param {string} koText - Translated Korean text
   */
  function renderSubtitles(jaRaw, koText) {
    if (!settings.enabled || !jaRaw.trim()) {
      clearSubtitles();
      return;
    }

    ensureOverlay();
    if (!subtitleBox) return;

    // Build Japanese line (with Furigana or plain)
    let jaHtml = '';
    if (settings.showFurigana && typeof toFurigana === 'function') {
      jaHtml = toFurigana(jaRaw);
    } else {
      jaHtml = escapeHtml(jaRaw);
    }

    const jaElement = document.createElement('span');
    jaElement.className = 'nds-line-ja';
    jaElement.innerHTML = jaHtml;

    const koElement = document.createElement('span');
    koElement.className = 'nds-line-ko';
    koElement.textContent = koText;

    subtitleBox.innerHTML = '';

    // Arrange position
    if (settings.subPosition === 'ja-top') {
      jaElement.classList.add('nds-sub-top');
      if (koText) koElement.classList.add('nds-sub-bottom');
      subtitleBox.appendChild(jaElement);
      if (koText) subtitleBox.appendChild(koElement);
    } else {
      if (koText) koElement.classList.add('nds-sub-top');
      jaElement.classList.add('nds-sub-bottom');
      if (koText) subtitleBox.appendChild(koElement);
      subtitleBox.appendChild(jaElement);
    }

    subtitleBox.style.display = 'inline-flex';
  }

  /**
   * Safely escapes HTML
   */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Extracts clean text content from Netflix's timedtext container
   */
  function extractSubtitleText(timedTextNode) {
    if (!timedTextNode) return '';

    // Netflix structure: .player-timedtext contains spans or text nodes
    const spans = timedTextNode.querySelectorAll('.player-timedtext-text-container span, span');
    if (spans.length > 0) {
      const lines = [];
      spans.forEach((span) => {
        const text = span.textContent.trim();
        if (text && !lines.includes(text)) {
          lines.push(text);
        }
      });
      return lines.join('\n');
    }

    return timedTextNode.innerText ? timedTextNode.innerText.trim() : timedTextNode.textContent.trim();
  }

  /**
   * Handles subtitle DOM changes
   */
  function onSubtitleMutation(timedTextEl) {
    if (!settings.enabled) return;

    const rawText = extractSubtitleText(timedTextEl);

    // If empty or subtitle cleared
    if (!rawText) {
      clearSubtitles();
      return;
    }

    // Skip if identical to current subtitle
    if (rawText === currentRawText) {
      return;
    }

    currentRawText = rawText;

    // Check if translation is already cached
    if (localTranslationCache.has(rawText)) {
      renderSubtitles(rawText, localTranslationCache.get(rawText));
      return;
    }

    // Step 1: Immediately render Japanese line with Furigana (0ms lag!)
    renderSubtitles(rawText, '');

    // Step 2: Request Korean translation asynchronously
    const requestedText = rawText;
    chrome.runtime.sendMessage(
      {
        type: 'TRANSLATE_TEXT',
        text: requestedText,
        sourceLang: 'ja',
        targetLang: 'ko'
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Netflix Dual Sub] Message error:', chrome.runtime.lastError);
          return;
        }

        if (response && response.success && response.translatedText) {
          localTranslationCache.set(requestedText, response.translatedText);
          // Only update if still on the same subtitle
          if (currentRawText === requestedText) {
            renderSubtitles(requestedText, response.translatedText);
          }
        }
      }
    );
  }

  /**
   * Attaches observer to the Netflix player-timedtext element
   */
  function initSubtitleObserver() {
    const timedTextEl = document.querySelector('.player-timedtext, [data-uia="player-timedtext"]');

    if (!timedTextEl) {
      return false;
    }

    if (timedTextObserver) {
      timedTextObserver.disconnect();
    }

    timedTextObserver = new MutationObserver(() => {
      onSubtitleMutation(timedTextEl);
    });

    timedTextObserver.observe(timedTextEl, {
      childList: true,
      subtree: true,
      characterData: true
    });

    ensureOverlay();
    onSubtitleMutation(timedTextEl);
    return true;
  }

  /**
   * Main observer that detects video player appearance/navigation
   */
  function startPlayerMonitor() {
    loadSettings();

    // Check if player is present
    if (!initSubtitleObserver()) {
      if (playerCheckInterval) clearInterval(playerCheckInterval);
      playerCheckInterval = setInterval(() => {
        if (initSubtitleObserver()) {
          clearInterval(playerCheckInterval);
          playerCheckInterval = null;
        }
      }, 1000);
    }

    // Also observe document for SPA page transitions (/watch/...)
    const pageObserver = new MutationObserver(() => {
      const playerExists = document.querySelector('.player-timedtext, [data-uia="player-timedtext"]');
      if (playerExists && !timedTextObserver) {
        initSubtitleObserver();
      }
    });

    pageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Initialize script
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPlayerMonitor);
  } else {
    startPlayerMonitor();
  }
})();
