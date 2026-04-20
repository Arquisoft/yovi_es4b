import React, { useMemo, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { uiSx } from '../theme';

type HelpCategoryId = 'all' | 'play' | 'online' | 'account' | 'issues';

type HelpSection = {
  title: string;
  body: string[];
  category: Exclude<HelpCategoryId, 'all'>;
};

type HelpCategory = {
  id: HelpCategoryId;
  label: string;
};

const helpCategories: HelpCategory[] = [
  { id: 'all', label: 'Todo' },
  { id: 'play', label: 'Jugar' },
  { id: 'online', label: 'Online' },
  { id: 'account', label: 'Cuenta' },
  { id: 'issues', label: 'Problemas' },
];

const helpSections: HelpSection[] = [
  {
    title: 'Reglas basicas',
    category: 'play',
    body: [
      'Tu objetivo es unir los tres lados del triangulo con una sola cadena continua de tus fichas.',
      'No hace falta llenar mucho tablero: gana quien complete antes esa conexion.',
    ],
  },
  {
    title: 'Si quieres empezar rapido',
    category: 'play',
    body: [
      'Si buscas una partida tranquila, empieza contra bot en un tablero pequeno. Terminaras antes y te sera mas facil leer la posicion.',
      'Si quieres mas estrategia, aumenta el tamano del tablero. Cuanto mas grande, mas caminos y mas posibilidades hay.',
    ],
  },
  {
    title: 'Como jugar durante una partida',
    category: 'play',
    body: [
      'Pulsa una celda vacia para colocar tu ficha cuando sea tu turno.',
      'Si necesitas cortar el ritmo o la posicion se ha torcido, puedes usar Ceder turno o Rendirse.',
      'Si sales de la vista del tablero por error, la partida activa se queda guardada para que puedas retomarla.',
    ],
  },
  {
    title: 'Ayuda con las pistas',
    category: 'play',
    body: [
      'El boton Pista te sugiere un movimiento cuando puedes jugar. No coloca la ficha por ti: la decision final sigue siendo tuya.',
      'Usala cuando no veas una continuacion clara o cuando quieras comparar tu idea con una alternativa.',
    ],
  },
  {
    title: 'Si juegas online',
    category: 'online',
    body: [
      'Pulsa Buscar rival y espera a que aparezca partida. Si cambias de idea, puedes cancelar la busqueda.',
      'La busqueda online cuenta por identidad: no puedes emparejarte contigo mismo, ni con tu mismo usuario, ni con la misma sesion de invitado abierta en otra pestana del mismo navegador.',
      'Si ya estabas buscando y vuelves a entrar, la aplicacion intenta recuperar esa busqueda o esa partida para que no pierdas el estado.',
    ],
  },
  {
    title: 'Que significan los avisos de tiempo',
    category: 'online',
    body: [
      'Si ves Tu turno o Turno del rival con cuenta atras, significa que esa jugada tiene tiempo limite.',
      'Si el tiempo llega a cero, el turno se cede automaticamente.',
      'Si aparece Rival desconectado, solo tienes que esperar: si no vuelve a tiempo, la partida se cerrara a tu favor por abandono.',
    ],
  },
  {
    title: 'Cuenta, invitado y estadisticas',
    category: 'account',
    body: [
      'Puedes entrar como invitado para probar el juego sin registrarte.',
      'Si quieres conservar historial, victorias, derrotas y ver tus estadisticas, necesitas iniciar sesion con una cuenta registrada.',
      'Dentro del historial, puedes pulsar las cabeceras de Resultado, Modo, Bot, Ganador y Fecha para filtrar u ordenar las partidas.',
      'Los filtros se pueden combinar entre si, asi que puedes quedarte, por ejemplo, solo con victorias contra bot o reordenar por las mas antiguas.',
    ],
  },
  {
    title: 'Si algo no te cuadra',
    category: 'issues',
    body: [
      'Si una partida parece quedarse a medias, vuelve a la pantalla principal y usa Volver a la partida si aparece.',
      'Si estabas en matchmaking y quieres empezar de cero, cancela la busqueda actual antes de lanzar otra.',
    ],
  },
];

const sectionOrder: Exclude<HelpCategoryId, 'all'>[] = ['play', 'online', 'account', 'issues'];

const categoryHeadings: Record<Exclude<HelpCategoryId, 'all'>, string> = {
  play: 'Jugar',
  online: 'Online',
  account: 'Cuenta',
  issues: 'Problemas',
};

const HelpView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<HelpCategoryId>('all');

  const groupedSections = useMemo(() => {
    const visibleSections =
      selectedCategory === 'all'
        ? helpSections
        : helpSections.filter((section) => section.category === selectedCategory);

    return sectionOrder
      .map((category) => ({
        category,
        heading: categoryHeadings[category],
        sections: visibleSections.filter((section) => section.category === category),
      }))
      .filter((group) => group.sections.length > 0);
  }, [selectedCategory]);

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

      <Box sx={uiSx.helpFilterRow}>
        {helpCategories.map((category) => {
          const selected = category.id === selectedCategory;

          return (
            <Button
              key={category.id}
              type="button"
              variant={selected ? 'contained' : 'outlined'}
              onClick={() => setSelectedCategory(category.id)}
              sx={uiSx.helpFilterButton(selected)}
            >
              {category.label}
            </Button>
          );
        })}
      </Box>

      <Box sx={uiSx.helpSectionsColumn}>
        {groupedSections.map((group) => (
          <Box key={group.category} sx={uiSx.helpSectionGroup}>
            <Typography variant="h6" sx={uiSx.helpSectionHeading}>
              {group.heading}
            </Typography>

            <Box sx={uiSx.helpSectionGrid}>
              {group.sections.map((section) => (
                <Box key={section.title} sx={uiSx.helpCard}>
                  <Typography variant="subtitle1" sx={uiSx.helpCardTitle}>
                    {section.title}
                  </Typography>

                  {section.body.map((paragraph) => (
                    <Typography key={paragraph} color="text.secondary" sx={uiSx.helpCardText}>
                      {paragraph}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default HelpView;
