export type GameOutcomeTone = 'success' | 'danger' | 'accent';

type ButtonPalette = {
  borderColor: string;
  color: string;
  backgroundColor: string;
  hoverBorderColor: string;
  hoverBackgroundColor: string;
  disabledBorderColor: string;
  disabledColor: string;
  disabledBackgroundColor: string;
};

type BadgePalette = {
  borderColor: string;
  color: string;
  backgroundColor: string;
  boxShadow: string;
};

const TEXT_PRIMARY = '#fbf7ef';
const TEXT_DISABLED = '#8e887f';
const TEXT_MUTED = '#aba59b';
const BADGE_SHADOW = 'inset 0 1px 0 rgba(255, 255, 255, 0.06)';
const BUTTON_SHADOW = 'inset 0 1px 0 rgba(255, 255, 255, 0.08)';

export function getGameOutcomePalette(tone: GameOutcomeTone) {
  switch (tone) {
    case 'success':
      return {
        borderColor: '#97cb64',
        backgroundColor: '#4f6f30',
        boxShadow: '0 10px 22px rgba(34, 46, 21, 0.24)',
      };
    case 'accent':
      return {
        borderColor: '#a8d27a',
        backgroundColor: '#586d36',
        boxShadow: '0 10px 22px rgba(41, 49, 25, 0.24)',
      };
    default:
      return {
        borderColor: '#d98982',
        backgroundColor: '#75423e',
        boxShadow: '0 10px 22px rgba(74, 35, 35, 0.24)',
      };
  }
}

export function getConfigTogglePalette(active: boolean): ButtonPalette {
  if (active) {
    return {
      borderColor: '#9dce67',
      color: TEXT_PRIMARY,
      backgroundColor: '#556f34',
      hoverBorderColor: '#b3df7d',
      hoverBackgroundColor: '#5f7f38',
      disabledBorderColor: 'rgba(141, 183, 92, 0.45)',
      disabledColor: TEXT_DISABLED,
      disabledBackgroundColor: '#4a6030',
    };
  }

  return {
    borderColor: 'rgba(133, 128, 120, 0.6)',
    color: '#c2c1bc',
    backgroundColor: '#47433f',
    hoverBorderColor: '#9dce67',
    hoverBackgroundColor: '#504b46',
    disabledBorderColor: 'rgba(123, 118, 109, 0.32)',
    disabledColor: TEXT_DISABLED,
    disabledBackgroundColor: '#3c3935',
  };
}

export function getOnlinePrimaryButtonPalette(): ButtonPalette {
  return {
    borderColor: '#9dce67',
    color: TEXT_PRIMARY,
    backgroundColor: '#516c31',
    hoverBorderColor: '#b3df7d',
    hoverBackgroundColor: '#5d7d38',
    disabledBorderColor: 'rgba(141, 183, 92, 0.38)',
    disabledColor: TEXT_MUTED,
    disabledBackgroundColor: '#42403b',
  };
}

export function getOnlineSecondaryButtonPalette(): ButtonPalette {
  return {
    borderColor: 'rgba(133, 128, 120, 0.6)',
    color: '#c2c1bc',
    backgroundColor: '#46423e',
    hoverBorderColor: 'rgba(196, 196, 188, 0.72)',
    hoverBackgroundColor: '#514b46',
    disabledBorderColor: 'rgba(115, 111, 104, 0.34)',
    disabledColor: TEXT_DISABLED,
    disabledBackgroundColor: '#3d3a36',
  };
}

export function getHistoryResultBadgePalette(won: boolean): BadgePalette {
  return won
    ? {
        borderColor: '#97cb64',
        color: TEXT_PRIMARY,
        backgroundColor: '#4f7131',
        boxShadow: BADGE_SHADOW,
      }
    : {
        borderColor: '#e28d87',
        color: TEXT_PRIMARY,
        backgroundColor: '#7d4640',
        boxShadow: BADGE_SHADOW,
      };
}

export function getHistoryModeBadgePalette(isBot: boolean): BadgePalette {
  return isBot
    ? {
        borderColor: '#97cb64',
        color: TEXT_PRIMARY,
        backgroundColor: '#4f7131',
        boxShadow: BADGE_SHADOW,
      }
    : {
        borderColor: 'rgba(170, 164, 154, 0.56)',
        color: TEXT_PRIMARY,
        backgroundColor: '#5a544d',
        boxShadow: BADGE_SHADOW,
      };
}

export function getButtonInsetShadow(): string {
  return BUTTON_SHADOW;
}
