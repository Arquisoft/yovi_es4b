import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { uiSx } from '../theme';

const HelpView: React.FC = () => {
  return (
    <Paper sx={uiSx.historyFullscreenCard}>
      <Box sx={uiSx.historyHeader}>
        <Typography variant="h5" sx={uiSx.dashboardCardTitle}>
          Ayuda
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Reglas basicas
          </Typography>
          <Typography color="text.secondary">
            El objetivo en Y es conectar los tres lados del triangulo con una sola cadena continua de tus fichas.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Como jugar
          </Typography>
          <Typography color="text.secondary">
            En tu turno, pulsa una celda vacia para colocar una ficha. El primero en cerrar una conexion entre los tres lados gana.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Modos y bots
          </Typography>
          <Typography color="text.secondary">
            Puedes jugar contra otra persona o contra bot.
          </Typography>
          <Typography color="text.secondary">Muy facil: random_bot.</Typography>
          <Typography color="text.secondary">Facil: biased_random_bot.</Typography>
          <Typography color="text.secondary">Intermedio: greedy_bot.</Typography>
          <Typography color="text.secondary">Dificil: minimax_bot.</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Tamano del tablero
          </Typography>
          <Typography color="text.secondary">
            Tableros pequenos terminan antes. Tableros grandes ofrecen mas estrategia y partidas mas largas.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Para que sirve Estadisticas
          </Typography>
          <Typography color="text.secondary">
            Muestra victorias, derrotas, total de partidas y el historial reciente para analizar tu progreso y detectar patrones.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default HelpView;
