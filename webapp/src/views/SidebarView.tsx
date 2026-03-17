import React from 'react';
import { Box } from '@mui/material';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { uiSx } from '../theme';
import playIcon from '../assets/play-button-svgrepo-com (1).svg';
import statsIcon from '../assets/stats-graph-svgrepo-com.svg';
import logOutIcon from '../assets/logout-svgrepo-com.svg';

type Props = {
  onOpenPlay: () => void;
  onOpenStats: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
};

const SidebarView: React.FC<Props> = ({ onOpenPlay, onOpenStats, onOpenHelp, onLogout }) => {
  return (
    <Box component="aside" sx={uiSx.sidebar}>
      <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onOpenPlay}>
        <Box component="span" sx={uiSx.sidebarItemContent}>
          <Box component="img" src={playIcon} alt="" aria-hidden sx={uiSx.sidebarItemIcon} />
          <Box component="span">Jugar</Box>
        </Box>
      </Box>

      <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onOpenStats}>
        <Box component="span" sx={uiSx.sidebarItemContent}>
          <Box component="img" src={statsIcon} alt="" aria-hidden sx={uiSx.sidebarItemIcon} />
          <Box component="span">Estadisticas</Box>
        </Box>
      </Box>

      <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onOpenHelp}>
        <Box component="span" sx={uiSx.sidebarItemContent}>
          <HelpOutlineRoundedIcon sx={{ fontSize: 20 }} aria-hidden />
          <Box component="span">Ayuda</Box>
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


