const test = require('node:test');
const assert = require('node:assert/strict');

async function loadThemeVisuals() {
  return import('../.node-coverage-build/themeVisuals.js');
}

test('returns the expected palette for all game outcome tones', async () => {
  const { getGameOutcomePalette } = await loadThemeVisuals();

  assert.deepEqual(getGameOutcomePalette('success'), {
    borderColor: '#97cb64',
    backgroundColor: '#4f6f30',
    boxShadow: '0 10px 22px rgba(34, 46, 21, 0.24)',
  });

  assert.deepEqual(getGameOutcomePalette('accent'), {
    borderColor: '#a8d27a',
    backgroundColor: '#586d36',
    boxShadow: '0 10px 22px rgba(41, 49, 25, 0.24)',
  });

  assert.deepEqual(getGameOutcomePalette('danger'), {
    borderColor: '#d98982',
    backgroundColor: '#75423e',
    boxShadow: '0 10px 22px rgba(74, 35, 35, 0.24)',
  });
});

test('returns active and inactive palettes for config toggles', async () => {
  const { getConfigTogglePalette } = await loadThemeVisuals();

  assert.deepEqual(getConfigTogglePalette(true), {
    borderColor: '#9dce67',
    color: '#fbf7ef',
    backgroundColor: '#556f34',
    hoverBorderColor: '#b3df7d',
    hoverBackgroundColor: '#5f7f38',
    disabledBorderColor: 'rgba(141, 183, 92, 0.45)',
    disabledColor: '#8e887f',
    disabledBackgroundColor: '#4a6030',
  });

  assert.deepEqual(getConfigTogglePalette(false), {
    borderColor: 'rgba(133, 128, 120, 0.6)',
    color: '#c2c1bc',
    backgroundColor: '#47433f',
    hoverBorderColor: '#9dce67',
    hoverBackgroundColor: '#504b46',
    disabledBorderColor: 'rgba(123, 118, 109, 0.32)',
    disabledColor: '#8e887f',
    disabledBackgroundColor: '#3c3935',
  });
});

test('returns the online button palettes and inset shadow', async () => {
  const { getButtonInsetShadow, getOnlinePrimaryButtonPalette, getOnlineSecondaryButtonPalette } = await loadThemeVisuals();

  assert.equal(getButtonInsetShadow(), 'inset 0 1px 0 rgba(255, 255, 255, 0.08)');

  assert.deepEqual(getOnlinePrimaryButtonPalette(), {
    borderColor: '#9dce67',
    color: '#fbf7ef',
    backgroundColor: '#516c31',
    hoverBorderColor: '#b3df7d',
    hoverBackgroundColor: '#5d7d38',
    disabledBorderColor: 'rgba(141, 183, 92, 0.38)',
    disabledColor: '#aba59b',
    disabledBackgroundColor: '#42403b',
  });

  assert.deepEqual(getOnlineSecondaryButtonPalette(), {
    borderColor: 'rgba(133, 128, 120, 0.6)',
    color: '#c2c1bc',
    backgroundColor: '#46423e',
    hoverBorderColor: 'rgba(196, 196, 188, 0.72)',
    hoverBackgroundColor: '#514b46',
    disabledBorderColor: 'rgba(115, 111, 104, 0.34)',
    disabledColor: '#8e887f',
    disabledBackgroundColor: '#3d3a36',
  });
});

test('returns the expected history badge palettes', async () => {
  const { getHistoryModeBadgePalette, getHistoryResultBadgePalette } = await loadThemeVisuals();

  assert.deepEqual(getHistoryResultBadgePalette(true), {
    borderColor: '#97cb64',
    color: '#fbf7ef',
    backgroundColor: '#4f7131',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  });

  assert.deepEqual(getHistoryResultBadgePalette(false), {
    borderColor: '#e28d87',
    color: '#fbf7ef',
    backgroundColor: '#7d4640',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  });

  assert.deepEqual(getHistoryModeBadgePalette(true), {
    borderColor: '#97cb64',
    color: '#fbf7ef',
    backgroundColor: '#4f7131',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  });

  assert.deepEqual(getHistoryModeBadgePalette(false), {
    borderColor: 'rgba(170, 164, 154, 0.56)',
    color: '#fbf7ef',
    backgroundColor: '#5a544d',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  });
});
