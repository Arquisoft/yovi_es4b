import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { uiSx } from '../theme';

type Props = {
  onPlayBotEasy: () => void;
  onPlayHuman: () => void;
  onLogout: () => void;
};

const SidebarView: React.FC<Props> = ({ onPlayBotEasy, onPlayHuman, onLogout }) => {
  const [open, setOpen] = useState(false);

  return (
    <Box component="aside" sx={uiSx.sidebar}>
      <Box
        sx={uiSx.sidebarPlayGroup}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Box component="button" type="button" sx={uiSx.sidebarItem(open)}>
          Jugar
        </Box>

        <Box sx={uiSx.sidebarSubmenu(open)}>
          <Typography component="div" sx={uiSx.sidebarSubmenuTitle}>
            Contra bot
          </Typography>
          <Box component="button" type="button" sx={uiSx.sidebarOption} onClick={onPlayBotEasy}>
            Facil
          </Box>
          <Typography component="div" sx={uiSx.sidebarOptionDisabled}>
            Intermedio
          </Typography>
          <Typography component="div" sx={uiSx.sidebarOptionDisabled}>
            Dificil
          </Typography>
          <Box sx={uiSx.sidebarSubmenuDivider} />
          <Box component="button" type="button" sx={uiSx.sidebarOption} onClick={onPlayHuman}>
            Contra humano
          </Box>
        </Box>
      </Box>

      <Box sx={uiSx.sidebarBottom}>
        <Box component="button" type="button" sx={uiSx.sidebarItem(false)} onClick={onLogout}>
          Logout
        </Box>
      </Box>
    </Box>
  );
};

export default SidebarView;
