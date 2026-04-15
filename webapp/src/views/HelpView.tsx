import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { uiSx } from '../theme';

type HelpSection = {
  title: string;
  body: string[];
};

const helpSections: HelpSection[] = [
  {
    title: 'Reglas basicas',
    body: [
      'Tu objetivo es unir los tres lados del triangulo con una sola cadena continua de tus fichas.',
      'No hace falta llenar mucho tablero: gana quien complete antes esa conexion.',
    ],
  },
  {
    title: 'Si quieres empezar rapido',
    body: [
      'Si buscas una partida tranquila, empieza contra bot en un tablero pequeno. Terminaras antes y te sera mas facil leer la posicion.',
      'Si quieres mas estrategia, aumenta el tamano del tablero. Cuanto mas grande, mas caminos y mas posibilidades hay.',
    ],
  },
  {
    title: 'Como jugar durante una partida',
    body: [
      'Pulsa una celda vacia para colocar tu ficha cuando sea tu turno.',
      'Si necesitas cortar el ritmo o la posicion se ha torcido, puedes usar Ceder turno o Rendirse.',
      'Si sales de la vista del tablero por error, la partida activa se queda guardada para que puedas retomarla.',
    ],
  },
  {
    title: 'Ayuda con las pistas',
    body: [
      'El boton Pista te sugiere un movimiento cuando puedes jugar. No coloca la ficha por ti: la decision final sigue siendo tuya.',
      'Usala cuando no veas una continuacion clara o cuando quieras comparar tu idea con una alternativa.',
    ],
  },
  {
    title: 'Si juegas online',
    body: [
      'Pulsa Buscar rival y espera a que aparezca partida. Si cambias de idea, puedes cancelar la busqueda.',
      'La busqueda online cuenta por identidad: no puedes emparejarte contigo mismo, ni con tu mismo usuario, ni con la misma sesion de invitado abierta en otra pestana del mismo navegador.',
      'Si ya estabas buscando y vuelves a entrar, la aplicacion intenta recuperar esa busqueda o esa partida para que no pierdas el estado.',
    ],
  },
  {
    title: 'Que significan los avisos de tiempo',
    body: [
      'Si ves Tu turno o Turno del rival con cuenta atras, significa que esa jugada tiene tiempo limite.',
      'Si el tiempo llega a cero, el turno se cede automaticamente.',
      'Si aparece Rival desconectado, solo tienes que esperar: si no vuelve a tiempo, la partida se cerrara a tu favor por abandono.',
    ],
  },
  {
    title: 'Cuenta, invitado y estadisticas',
    body: [
      'Puedes entrar como invitado para probar el juego sin registrarte.',
      'Si quieres conservar historial, victorias, derrotas y ver tus estadisticas, necesitas iniciar sesion con una cuenta registrada.',
      'Dentro del historial, puedes pulsar las cabeceras de Resultado, Modo, Bot, Ganador y Fecha para filtrar u ordenar las partidas.',
      'Los filtros se pueden combinar entre si, asi que puedes quedarte, por ejemplo, solo con victorias contra bot o reordenar por las mas antiguas.',
    ],
  },
  {
    title: 'Si algo no te cuadra',
    body: [
      'Si una partida parece quedarse a medias, vuelve a la pantalla principal y usa Volver a la partida si aparece.',
      'Si estabas en matchmaking y quieres empezar de cero, cancela la busqueda actual antes de lanzar otra.',
    ],
  },
];

const HelpView: React.FC = () => {
  return (
    <Paper sx={uiSx.historyFullscreenCard}>
      <Box sx={uiSx.historyHeader}>
        <Typography variant="h5" sx={uiSx.dashboardCardTitle}>
          Ayuda
        </Typography>
      </Box>

      <Box sx={uiSx.historyTableHint}>
        Si vienes con una duda puntual, empieza por el bloque que mas se parezca a tu situacion.
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        {helpSections.map((section) => (
          <Box
            key={section.title}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.8,
              backgroundColor: 'rgba(44, 42, 39, 0.65)',
              px: 1.6,
              py: 1.4,
              display: 'grid',
              gap: 0.85,
              alignContent: 'start',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.18 }}>
              {section.title}
            </Typography>

            {section.body.map((paragraph) => (
              <Typography key={paragraph} color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {paragraph}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default HelpView;
