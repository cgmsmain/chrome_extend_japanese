/**
 * Netflix Dual Subtitles - Background Service Worker (Manifest V3)
 * Handles translation requests and default settings initialization.
 */

// In-memory translation cache (cleared when worker restarts)
const translationCache = new Map();

// Default user settings
const DEFAULT_SETTINGS = {
  enabled: true,               // Master toggle: dual subtitles on/off
  showFurigana: true,          // Furigana on/off for Kanji
  subPosition: 'ja-top',       // 'ja-top': Japanese on top, Korean on bottom. 'ko-top': Korean on top.
  fontSize: 22,                // Base font size in px
  furiganaRatio: 55,           // Furigana size relative to kanji in %
  textColor: '#ffffff',        // Subtitle text color
  furiganaColor: '#ffea00',    // Furigana (reading) text color
  bgEnabled: true,             // Semi-transparent background box
  bgOpacity: 65                // Background opacity in % (0 - 100)
};

// Initialize default settings on extension installation or update
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.sync.get(null);
    const toSet = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) {
        toSet[key] = value;
      }
    }
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.sync.set(toSet);
    }
    console.log('[Netflix Dual Sub] Initialized settings:', toSet);
  } catch (err) {
    console.error('[Netflix Dual Sub] Failed to initialize settings:', err);
  }
});

/**
 * Calls Google Translate free API endpoint to translate Japanese text to Korean
 * @param {string} text - Text to translate
 * @param {string} sourceLang - 'ja'
 * @param {string} targetLang - 'ko'
 * @returns {Promise<string>} - Translated text
 */
async function fetchTranslation(text, sourceLang = 'ja', targetLang = 'ko') {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cacheKey = `${sourceLang}:${targetLang}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sourceLang
  )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation HTTP error: ${response.status}`);
    }

    const data = await response.json();
    // Google translate returns an array: data[0] is an array of segments [[translated, original], ...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      let translated = '';
      for (const segment of data[0]) {
        if (segment && segment[0]) {
          translated += segment[0];
        }
      }

      // Cache up to 2000 lines
      if (translationCache.size > 2000) {
        translationCache.clear();
      }
      translationCache.set(cacheKey, translated);
      return translated;
    }

    return trimmed;
  } catch (error) {
    console.error('[Netflix Dual Sub] Translation fetch failed:', error);
    return ''; // Return empty string on network failure so fallback can be handled
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRANSLATE_TEXT') {
    fetchTranslation(request.text, request.sourceLang || 'ja', request.targetLang || 'ko')
      .then((translatedText) => {
        sendResponse({ success: true, translatedText });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    // Return true to indicate asynchronous response
    return true;
  }

  if (request.type === 'CLEAR_CACHE') {
    translationCache.clear();
    sendResponse({ success: true });
    return false;
  }
});
