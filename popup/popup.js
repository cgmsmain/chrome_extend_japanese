/**
 * Netflix Dual Subtitles - Popup Controller
 */

const DEFAULT_SETTINGS = {
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

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const enabledInput = document.getElementById('enabled');
  const showFuriganaInput = document.getElementById('showFurigana');
  const subPositionInput = document.getElementById('subPosition');
  const fontSizeInput = document.getElementById('fontSize');
  const fontSizeVal = document.getElementById('fontSizeVal');
  const furiganaRatioInput = document.getElementById('furiganaRatio');
  const furiganaRatioVal = document.getElementById('furiganaRatioVal');
  const textColorInput = document.getElementById('textColor');
  const furiganaColorInput = document.getElementById('furiganaColor');
  const bgOpacityInput = document.getElementById('bgOpacity');
  const bgOpacityVal = document.getElementById('bgOpacityVal');
  const resetBtn = document.getElementById('resetBtn');

  // Preview elements
  const previewBox = document.getElementById('previewBox');
  const previewJa = document.getElementById('previewJa');
  const previewKo = document.getElementById('previewKo');

  // Load stored settings
  const currentSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  function updateUI(settings) {
    enabledInput.checked = !!settings.enabled;
    showFuriganaInput.checked = !!settings.showFurigana;
    subPositionInput.value = settings.subPosition || 'ja-top';
    fontSizeInput.value = settings.fontSize || 22;
    fontSizeVal.textContent = `${fontSizeInput.value}px`;
    furiganaRatioInput.value = settings.furiganaRatio || 55;
    furiganaRatioVal.textContent = `${furiganaRatioInput.value}%`;
    textColorInput.value = settings.textColor || '#ffffff';
    furiganaColorInput.value = settings.furiganaColor || '#ffea00';
    bgOpacityInput.value = settings.bgOpacity !== undefined ? settings.bgOpacity : 65;
    bgOpacityVal.textContent = `${bgOpacityInput.value}%`;

    // Update Status Badge
    if (settings.enabled) {
      statusBadge.textContent = 'ON';
      statusBadge.classList.remove('off');
    } else {
      statusBadge.textContent = 'OFF';
      statusBadge.classList.add('off');
    }

    updatePreview(settings);
  }

  function updatePreview(settings) {
    if (!previewBox) return;

    if (!settings.enabled) {
      previewBox.style.opacity = '0.35';
    } else {
      previewBox.style.opacity = '1';
    }

    // Font size & colors
    previewBox.style.fontSize = `${settings.fontSize}px`;
    const alpha = settings.bgOpacity / 100;
    previewBox.style.backgroundColor = `rgba(0, 0, 0, ${alpha})`;
    previewKo.style.color = settings.textColor;

    // Furigana toggle & color
    const rtElements = previewJa.querySelectorAll('rt');
    rtElements.forEach((rt) => {
      if (settings.showFurigana) {
        rt.style.display = '';
        rt.style.fontSize = `${settings.furiganaRatio / 100}em`;
        rt.style.color = settings.furiganaColor;
      } else {
        rt.style.display = 'none';
      }
    });

    // Positioning
    if (settings.subPosition === 'ja-top') {
      previewBox.style.flexDirection = 'column';
      previewJa.style.order = '1';
      previewKo.style.order = '2';
      previewJa.style.marginBottom = '4px';
      previewKo.style.marginTop = '0';
    } else {
      previewBox.style.flexDirection = 'column';
      previewKo.style.order = '1';
      previewJa.style.order = '2';
      previewKo.style.marginBottom = '4px';
      previewJa.style.marginTop = '0';
    }
  }

  function getFormSettings() {
    return {
      enabled: enabledInput.checked,
      showFurigana: showFuriganaInput.checked,
      subPosition: subPositionInput.value,
      fontSize: parseInt(fontSizeInput.value, 10),
      furiganaRatio: parseInt(furiganaRatioInput.value, 10),
      textColor: textColorInput.value,
      furiganaColor: furiganaColorInput.value,
      bgEnabled: true,
      bgOpacity: parseInt(bgOpacityInput.value, 10)
    };
  }

  async function saveAndApply() {
    const newSettings = getFormSettings();
    await chrome.storage.sync.set(newSettings);
    updateUI(newSettings);
  }

  // Event Listeners
  enabledInput.addEventListener('change', saveAndApply);
  showFuriganaInput.addEventListener('change', saveAndApply);
  subPositionInput.addEventListener('change', saveAndApply);

  fontSizeInput.addEventListener('input', () => {
    fontSizeVal.textContent = `${fontSizeInput.value}px`;
    saveAndApply();
  });

  furiganaRatioInput.addEventListener('input', () => {
    furiganaRatioVal.textContent = `${furiganaRatioInput.value}%`;
    saveAndApply();
  });

  bgOpacityInput.addEventListener('input', () => {
    bgOpacityVal.textContent = `${bgOpacityInput.value}%`;
    saveAndApply();
  });

  textColorInput.addEventListener('input', saveAndApply);
  furiganaColorInput.addEventListener('input', saveAndApply);

  // Reset Button
  resetBtn.addEventListener('click', async () => {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    updateUI(DEFAULT_SETTINGS);
  });

  // Initial render
  updateUI(currentSettings);
});
