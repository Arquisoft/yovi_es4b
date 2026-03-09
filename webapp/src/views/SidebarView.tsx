import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { uiSx } from '../theme';
import playIcon from '../assets/play-button-svgrepo-com (1).svg';
import statsIcon from '../assets/stats-graph-svgrepo-com.svg';
import logOutIcon from '../assets/logout-svgrepo-com.svg';
import { botDifficultyOptions, type BotDifficulty } from './statsTypes';

type Props = {
  onPlayBot: (difficulty: BotDifficulty) => void;
  onPlayHuman: () => void;
  onOpenStats: () => void;
  onLogout: () => void;
};

const SidebarView: React.FC<Props> = ({ onPlayBot, onPlayHuman, onOpenStats, onLogout }) => {
  const [open, setOpen] = useState(false);

  return (
    <Box component="aside" sx={uiSx.sidebar}>
      <Box
        sx={uiSx.sidebarPlayGroup}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Box component="button" type="button" sx={uiSx.sidebarItem(open)}>
          <Box component="span" sx={uiSx.sidebarItemContent}>
            <Box component="img" src={playIcon} alt="" aria-hidden sx={uiSx.sidebarItemIcon} />
            <Box component="span">Jugar</Box>
          </Box>
        </Box>

        <Box sx={uiSx.sidebarSubmenu(open)}>
          <Typography component="div" sx={uiSx.sidebarSubmenuTitle}>
            Contra bot
          </Typography>
          {botDifficultyOptions.map((option) => (
            <Box
              key={option.value}
              component="button"
              type="button"
              sx={uiSx.sidebarOption}
              onClick={() => onPlayBot(option.value)}
            >
              {option.label}
            </Box>
          ))}
          <Box sx={uiSx.sidebarSubmenuDivider} />
          <Box component="button" type="button" sx={uiSx.sidebarOption} onClick={onPlayHuman}>
            Contra humano
          </Box>
        </Box>
      </Box>

      <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onOpenStats}>
        <Box component="span" sx={uiSx.sidebarItemContent}>
          <Box component="img" src={statsIcon} alt="" aria-hidden sx={uiSx.sidebarItemIcon} />
          <Box component="span">Estadisticas</Box>
        </Box>
      </Box>

      <Box sx={uiSx.sidebarBottom}>
        <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onLogout}>
          <Box component="span" sx={uiSx.sidebarItemContent}>
            <Box component="img" src={logOutIcon} alt="" aria-hidden sx={uiSx.sidebarItemIcon} />
            <Box component="span">Logout</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SidebarView;


