/**
 * Furigana Generator for Japanese Subtitles
 * Converts Kanji into HTML <ruby> tags with Hiragana readings.
 */

// Safe dictionary resolver without var/const collision
function getKanjiDict() {
  if (typeof KANJI_DICT !== 'undefined') {
    return KANJI_DICT;
  }
  if (typeof globalThis !== 'undefined' && globalThis.KANJI_DICT) {
    return globalThis.KANJI_DICT;
  }
  if (typeof window !== 'undefined' && window.KANJI_DICT) {
    return window.KANJI_DICT;
  }
  if (typeof require !== 'undefined') {
    try {
      return require('./kanji_dict.js');
    } catch (e) {}
  }
  return { vocab: {}, stems: {}, single: {} };
}

const HAS_KANJI_REGEX = /[\u4e00-\u9faf]/;
const KANJI_CHAR_REGEX = /[\u4e00-\u9faf]/;
const KANJI_STEM_OKURIGANA_REGEX = /^([\u4e00-\u9faf]+)([\u3040-\u309f]+)$/;

// In-memory cache for processed sentences to ensure 0ms latency on repeats
const furiganaSentenceCache = new Map();

/**
 * Escapes HTML characters
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Converts a single word/segment into Ruby HTML if it contains Kanji.
 * @param {string} word - The tokenized word
 * @returns {string} - HTML string with <ruby> tags
 */
function convertWordToRuby(word) {
  if (!HAS_KANJI_REGEX.test(word)) {
    return escapeHtml(word);
  }

  const dict = getKanjiDict();

  // 1. Direct vocabulary lookup (e.g., '今日' -> 'きょう', '日本語' -> 'にほんご')
  if (dict.vocab && dict.vocab[word]) {
    return `<ruby>${escapeHtml(word)}<rt>${escapeHtml(dict.vocab[word])}</rt></ruby>`;
  }

  // 2. Kanji stem + Okurigana (e.g., '食べた' -> '食[た]べた', '行きます' -> '行[い]きます')
  const okuriganaMatch = word.match(KANJI_STEM_OKURIGANA_REGEX);
  if (okuriganaMatch) {
    const kanjiPart = okuriganaMatch[1];
    const kanaPart = okuriganaMatch[2];

    // Check stem table
    if (dict.stems && dict.stems[kanjiPart]) {
      const stemRules = dict.stems[kanjiPart];
      // Check full kana or initial character of okurigana
      let reading = stemRules[kanaPart] || stemRules[kanaPart[0]];
      if (!reading && kanaPart.length > 1) {
        reading = stemRules[kanaPart.slice(0, 2)];
      }

      if (reading) {
        return `<ruby>${escapeHtml(kanjiPart)}<rt>${escapeHtml(reading)}</rt></ruby>${escapeHtml(kanaPart)}`;
      }
    }

    // Fallback for single kanji stem
    if (kanjiPart.length === 1 && dict.single && dict.single[kanjiPart]) {
      return `<ruby>${escapeHtml(kanjiPart)}<rt>${escapeHtml(dict.single[kanjiPart])}</rt></ruby>${escapeHtml(kanaPart)}`;
    }
  }

  // 3. Multi-kanji compound or mixed phrase fallback: process character-by-character
  let result = '';
  let i = 0;
  while (i < word.length) {
    // Check 2-character sub-vocab first (e.g. in longer words)
    if (i + 1 < word.length) {
      const twoChar = word.slice(i, i + 2);
      if (dict.vocab && dict.vocab[twoChar]) {
        result += `<ruby>${escapeHtml(twoChar)}<rt>${escapeHtml(dict.vocab[twoChar])}</rt></ruby>`;
        i += 2;
        continue;
      }
    }

    const char = word[i];
    if (KANJI_CHAR_REGEX.test(char)) {
      const reading = (dict.single && dict.single[char]) || '';
      if (reading) {
        result += `<ruby>${escapeHtml(char)}<rt>${escapeHtml(reading)}</rt></ruby>`;
      } else {
        result += escapeHtml(char);
      }
    } else {
      result += escapeHtml(char);
    }
    i++;
  }

  return result;
}

/**
 * Main entry point: converts a full Japanese sentence to Ruby HTML
 * @param {string} text - Japanese subtitle text
 * @returns {string} - Full HTML string with ruby annotations
 */
function toFurigana(text) {
  if (!text || typeof text !== 'string') return '';
  if (!HAS_KANJI_REGEX.test(text)) {
    return escapeHtml(text);
  }

  if (furiganaSentenceCache.has(text)) {
    return furiganaSentenceCache.get(text);
  }

  let htmlResult = '';

  // Use Intl.Segmenter if supported (Chrome 87+)
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const segments = segmenter.segment(text);
    for (const { segment } of segments) {
      htmlResult += convertWordToRuby(segment);
    }
  } else {
    // Fallback tokenization by splitting into Kanji vs non-Kanji blocks
    const tokens = text.match(/[\u4e00-\u9faf]+[\u3040-\u309f]*|[^\u4e00-\u9faf]+/g) || [text];
    for (const token of tokens) {
      htmlResult += convertWordToRuby(token);
    }
  }

  // Cache up to 1000 sentences in memory
  if (furiganaSentenceCache.size > 1000) {
    furiganaSentenceCache.clear();
  }
  furiganaSentenceCache.set(text, htmlResult);

  return htmlResult;
}

// Export for module or global
if (typeof window !== 'undefined') {
  window.toFurigana = toFurigana;
  window.convertWordToRuby = convertWordToRuby;
}
if (typeof globalThis !== 'undefined') {
  globalThis.toFurigana = toFurigana;
  globalThis.convertWordToRuby = convertWordToRuby;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toFurigana, convertWordToRuby };
}
