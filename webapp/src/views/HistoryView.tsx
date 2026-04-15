import React, { useEffect, useMemo, useState } from 'react';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import { findWinningConnectionCellKeysFromBoard, toBoardCellsFromYen } from '../gameyUi';
import { uiColors, uiSx } from '../theme';
import { botHistoryLabels, type MatchHistoryItem, type PlayerStatsSummary } from '../stats/types';

type Props = {
  playerStats: PlayerStatsSummary;
  matches: MatchHistoryItem[];
};

type ResultFilter = 'all' | 'win' | 'loss';
type ModeFilter = 'all' | 'human_vs_bot' | 'human_vs_human';
type BotFilter = 'all' | 'with_bot' | 'without_bot' | `bot:${string}`;
type WinnerFilter = 'all' | 'without_winner' | `winner:${string}`;
type DateSort = 'recent_first' | 'oldest_first';
type FilterMenuKey = 'result' | 'mode' | 'bot' | 'winner' | 'date';

type HistoryFilters = {
  result: ResultFilter;
  mode: ModeFilter;
  bot: BotFilter;
  winner: WinnerFilter;
  dateSort: DateSort;
};

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  result: 'all',
  mode: 'all',
  bot: 'all',
  winner: 'all',
  dateSort: 'recent_first',
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  if (mode === 'human_vs_bot') return 'Bot';
  if (mode === 'human_vs_human') return 'Humano';
  return '-';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

function formatBotLabel(botId: string | null) {
  return botId ? botHistoryLabels[botId] ?? botId : '-';
}

function getMatchTimestamp(match: MatchHistoryItem) {
  const timestamp = new Date(match.endedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildBotFilterOptions(matches: MatchHistoryItem[]): FilterOption<BotFilter>[] {
  const uniqueBotIds = Array.from(
    new Set(
      matches
        .map((match) => match.botId)
        .filter((botId): botId is string => typeof botId === 'string' && botId.trim().length > 0),
    ),
  );

  return [
    { value: 'all', label: 'Todos' },
    { value: 'with_bot', label: 'Con bot' },
    { value: 'without_bot', label: 'Sin bot' },
    ...uniqueBotIds.map((botId) => ({
      value: `bot:${botId}` as const,
      label: formatBotLabel(botId),
    })),
  ];
}

function buildWinnerFilterOptions(matches: MatchHistoryItem[]): FilterOption<WinnerFilter>[] {
  const uniqueWinnerIds = Array.from(
    new Set(
      matches
        .map((match) => match.winnerId)
        .filter((winnerId): winnerId is string => typeof winnerId === 'string' && winnerId.trim().length > 0),
    ),
  );

  return [
    { value: 'all', label: 'Todos' },
    { value: 'without_winner', label: 'Sin ganador' },
    ...uniqueWinnerIds.map((winnerId) => ({
      value: `winner:${winnerId}` as const,
      label: winnerId,
    })),
  ];
}

function getSelectedOptionLabel<T extends string>(
  options: ReadonlyArray<FilterOption<T>>,
  value: T,
  fallback = 'Todos',
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function matchesResultFilter(match: MatchHistoryItem, resultFilter: ResultFilter) {
  return resultFilter === 'all' || match.result === resultFilter;
}

function matchesModeFilter(match: MatchHistoryItem, modeFilter: ModeFilter) {
  return modeFilter === 'all' || match.mode === modeFilter;
}

function matchesBotFilter(match: MatchHistoryItem, botFilter: BotFilter) {
  if (botFilter === 'all') return true;
  if (botFilter === 'with_bot') return match.botId !== null;
  if (botFilter === 'without_bot') return match.botId === null;
  return match.botId === botFilter.slice(4);
}

function matchesWinnerFilter(match: MatchHistoryItem, winnerFilter: WinnerFilter) {
  if (winnerFilter === 'all') return true;
  if (winnerFilter === 'without_winner') return match.winnerId === null;
  return match.winnerId === winnerFilter.slice(7);
}

function buildHeaderButtonSx(active: boolean) {
  return {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 0.45,
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    '&:hover .history-filter-chip': {
      borderColor: active ? uiColors.accent.light : uiColors.border.strong,
      backgroundColor: active ? 'rgba(129, 182, 76, 0.18)' : 'rgba(255, 255, 255, 0.06)',
    },
    '&:hover .history-filter-value': {
      color: uiColors.text.primary,
    },
    '&:hover .history-filter-caret': {
      color: active ? uiColors.accent.light : uiColors.text.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${uiColors.accent.light}`,
      outlineOffset: 2,
      borderRadius: 4,
    },
    '& .history-filter-value': {
      color: active ? uiColors.accent.light : uiColors.text.secondary,
    },
  } as const;
}

function buildHeaderFilterChipSx(active: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.45,
    minWidth: 0,
    maxWidth: '100%',
    px: 0.85,
    py: 0.45,
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(129, 182, 76, 0.5)' : uiColors.border.faint}`,
    backgroundColor: active ? 'rgba(129, 182, 76, 0.14)' : 'rgba(255, 255, 255, 0.03)',
    transition: 'border-color 0.18s ease, background-color 0.18s ease',
  } as const;
}

function getHeaderFilterContextLabel(menuKey: FilterMenuKey) {
  return menuKey === 'date' ? 'Orden' : 'Filtro';
}

function buildHeaderFilterCaretSx(expanded: boolean) {
  return {
    fontSize: '1rem',
    color: uiColors.text.muted,
    flexShrink: 0,
    transition: 'transform 0.18s ease, color 0.18s ease',
    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  } as const;
}

const HistoryView: React.FC<Props> = ({ playerStats, matches }) => {
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryItem | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [openMenuKey, setOpenMenuKey] = useState<FilterMenuKey | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const selectedFinalBoard = selectedMatch?.finalBoard ?? null;
  const winRate = playerStats.totalGames > 0 ? Math.round((playerStats.victories / playerStats.totalGames) * 100) : 0;
  const updatedAtText = playerStats.updatedAt
    ? new Date(playerStats.updatedAt).toLocaleDateString()
    : 'Sin partidas';
  const resultFilterOptions: ReadonlyArray<FilterOption<ResultFilter>> = [
    { value: 'all', label: 'Todos' },
    { value: 'win', label: 'Solo victorias' },
    { value: 'loss', label: 'Solo derrotas' },
  ];
  const modeFilterOptions: ReadonlyArray<FilterOption<ModeFilter>> = [
    { value: 'all', label: 'Todos' },
    { value: 'human_vs_bot', label: 'Solo bot' },
    { value: 'human_vs_human', label: 'Solo humano' },
  ];
  const dateSortOptions: ReadonlyArray<FilterOption<DateSort>> = [
    { value: 'recent_first', label: 'Mas recientes primero' },
    { value: 'oldest_first', label: 'Mas antiguas primero' },
  ];

  const previewBoard = useMemo(
    () => (selectedFinalBoard ? toBoardCellsFromYen(selectedFinalBoard) : []),
    [selectedFinalBoard],
  );

  const previewWinningCells = useMemo(
    () => (selectedFinalBoard ? findWinningConnectionCellKeysFromBoard(selectedFinalBoard) : new Set<string>()),
    [selectedFinalBoard],
  );

  const botFilterOptions = useMemo(() => buildBotFilterOptions(matches), [matches]);
  const winnerFilterOptions = useMemo(() => buildWinnerFilterOptions(matches), [matches]);

  const filteredMatches = useMemo(() => {
    const nextMatches = matches.filter((match) => {
      return (
        matchesResultFilter(match, filters.result) &&
        matchesModeFilter(match, filters.mode) &&
        matchesBotFilter(match, filters.bot) &&
        matchesWinnerFilter(match, filters.winner)
      );
    });

    return nextMatches.sort((leftMatch, rightMatch) => {
      const timestampDelta = getMatchTimestamp(leftMatch) - getMatchTimestamp(rightMatch);
      return filters.dateSort === 'oldest_first' ? timestampDelta : -timestampDelta;
    });
  }, [filters.bot, filters.dateSort, filters.mode, filters.result, filters.winner, matches]);

  const paginatedMatches = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredMatches.slice(start, end);
  }, [filteredMatches, page, rowsPerPage]);

  const maxPage = filteredMatches.length > 0 ? Math.ceil(filteredMatches.length / rowsPerPage) - 1 : 0;
  const safePage = Math.min(page, maxPage);
  const hasActiveFilters =
    filters.result !== DEFAULT_HISTORY_FILTERS.result ||
    filters.mode !== DEFAULT_HISTORY_FILTERS.mode ||
    filters.bot !== DEFAULT_HISTORY_FILTERS.bot ||
    filters.winner !== DEFAULT_HISTORY_FILTERS.winner ||
    filters.dateSort !== DEFAULT_HISTORY_FILTERS.dateSort;
  const visibleMatchesLabel = `Mostrando ${filteredMatches.length} de ${matches.length} partidas`;
  const noMatchesMessage =
    matches.length === 0
      ? 'Todavia no hay partidas registradas.'
      : 'No hay partidas que coincidan con los filtros actuales.';
  const resultFilterLabel = getSelectedOptionLabel(resultFilterOptions, filters.result);
  const modeFilterLabel = getSelectedOptionLabel(modeFilterOptions, filters.mode);
  const botFilterLabel = getSelectedOptionLabel(botFilterOptions, filters.bot);
  const winnerFilterLabel = getSelectedOptionLabel(winnerFilterOptions, filters.winner);
  const dateSortLabel = getSelectedOptionLabel(dateSortOptions, filters.dateSort);

  useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  useEffect(() => {
    setPage(0);
  }, [filters.bot, filters.dateSort, filters.mode, filters.result, filters.winner, matches]);

  const historyBoardStageSx = {
    ...uiSx.gameBoardStage,
    transform: 'none',
    mt: 0.8,
    mb: 0.8,
    px: { xs: 2.6, sm: 4.4 },
    pt: { xs: 3, sm: 4.2 },
    pb: { xs: 2, sm: 2.8 },
  };
  const headerLabelSx = {
    fontSize: '0.79rem',
    fontWeight: 700,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: uiColors.text.secondary,
    lineHeight: 1.1,
  } as const;
  const headerFilterContextSx = {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: uiColors.text.muted,
    lineHeight: 1,
    flexShrink: 0,
  } as const;
  const headerFilterChipSx = {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: 'none',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as const;
  const filterSummarySx = {
    mt: -0.4,
    mb: 0.1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1.2,
    flexWrap: 'wrap',
  } as const;
  const filterSummaryTextSx = {
    color: 'text.secondary',
    fontSize: '0.84rem',
    letterSpacing: 0.12,
  } as const;

  function openFilterMenu(menuKey: FilterMenuKey, anchorEl: HTMLElement) {
    setOpenMenuKey(menuKey);
    setMenuAnchorEl(anchorEl);
  }

  function closeFilterMenu() {
    setOpenMenuKey(null);
    setMenuAnchorEl(null);
  }

  function resetFilters() {
    setFilters(DEFAULT_HISTORY_FILTERS);
    closeFilterMenu();
  }

  function renderHeaderFilterButton(label: string, value: string, menuKey: FilterMenuKey) {
    const active =
      (menuKey === 'result' && filters.result !== 'all') ||
      (menuKey === 'mode' && filters.mode !== 'all') ||
      (menuKey === 'bot' && filters.bot !== 'all') ||
      (menuKey === 'winner' && filters.winner !== 'all') ||
      (menuKey === 'date' && filters.dateSort !== 'recent_first');
    const contextLabel = getHeaderFilterContextLabel(menuKey);
    const expanded = openMenuKey === menuKey;

    return (
      <Box
        component="button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={`${label}. ${contextLabel} actual: ${value}`}
        onClick={(event: React.MouseEvent<HTMLElement>) => openFilterMenu(menuKey, event.currentTarget)}
        sx={buildHeaderButtonSx(active)}
      >
        <Typography component="span" sx={headerLabelSx}>
          {label}
        </Typography>
        <Box component="span" className="history-filter-chip" sx={buildHeaderFilterChipSx(active)}>
          <Typography component="span" sx={headerFilterContextSx}>
            {contextLabel}
          </Typography>
          <Typography component="span" className="history-filter-value" sx={headerFilterChipSx}>
            {value}
          </Typography>
          <KeyboardArrowDownRoundedIcon
            aria-hidden="true"
            className="history-filter-caret"
            sx={buildHeaderFilterCaretSx(expanded)}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Paper sx={uiSx.historyFullscreenCard}>
      <Box sx={uiSx.historyHeader}>
        <Typography variant="h5" sx={uiSx.dashboardCardTitle}>
          Estadisticas
        </Typography>
      </Box>

      <Box sx={uiSx.historyStatsGrid}>
        <Box sx={uiSx.historyStatCard('neutral')}>
          <Typography sx={uiSx.historyStatLabel}>Partidas jugadas</Typography>
          <Typography sx={uiSx.historyStatValue}>{playerStats.totalGames}</Typography>
          <Typography sx={uiSx.historyStatMeta}>
            {playerStats.totalGames === 1 ? '1 partida registrada' : `${playerStats.totalGames} partidas registradas`}
          </Typography>
        </Box>

        <Box sx={uiSx.historyStatCard('win')}>
          <Typography sx={uiSx.historyStatLabel}>Victorias</Typography>
          <Typography sx={uiSx.historyStatValue}>{playerStats.victories}</Typography>
          <Typography sx={uiSx.historyStatMeta}>Ratio de victoria: {winRate}%</Typography>
          <Box sx={uiSx.historyWinrateTrack}>
            <Box sx={uiSx.historyWinrateFill(winRate)} />
          </Box>
        </Box>

        <Box sx={uiSx.historyStatCard('loss')}>
          <Typography sx={uiSx.historyStatLabel}>Derrotas</Typography>
          <Typography sx={uiSx.historyStatValue}>{playerStats.defeats}</Typography>
        </Box>

        <Box sx={uiSx.historyStatCard('info')}>
          <Typography sx={uiSx.historyStatLabel}>Actualizado</Typography>
          <Typography sx={uiSx.historyStatValue}>{updatedAtText}</Typography>
          <Typography sx={uiSx.historyStatMeta}>
            {playerStats.updatedAt
              ? `Ultimo sincronizado: ${new Date(playerStats.updatedAt).toLocaleTimeString()}`
              : 'Aun no se han jugado partidas'}
          </Typography>
        </Box>
      </Box>

      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Historial completo
      </Typography>

      <Typography sx={uiSx.historyTableHint}>
        Pulsa en las cabeceras para filtrar u ordenar las partidas. Tambien puedes abrir una fila o "Ver tablero"
        para revisar el estado final.
      </Typography>

      <Box sx={filterSummarySx}>
        <Typography sx={filterSummaryTextSx}>{visibleMatchesLabel}</Typography>
        <Button variant="text" onClick={resetFilters} disabled={!hasActiveFilters}>
          Limpiar filtros
        </Button>
      </Box>

      <TableContainer sx={uiSx.historyTableContainer}>
        <Table size="small" stickyHeader sx={uiSx.historyTable}>
          <TableHead>
            <TableRow>
              <TableCell sx={uiSx.historyTableHeadCell}>Partida</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>
                {renderHeaderFilterButton('Resultado', resultFilterLabel, 'result')}
              </TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>
                {renderHeaderFilterButton('Modo', modeFilterLabel, 'mode')}
              </TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>
                {renderHeaderFilterButton('Bot', botFilterLabel, 'bot')}
              </TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>
                {renderHeaderFilterButton('Ganador', winnerFilterLabel, 'winner')}
              </TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>
                {renderHeaderFilterButton('Fecha', dateSortLabel, 'date')}
              </TableCell>
              <TableCell sx={uiSx.historyTableHeadCell} align="right">
                Accion
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>{noMatchesMessage}</TableCell>
              </TableRow>
            )}
            {paginatedMatches.map((match) => {
              const canOpenBoard = Boolean(match.finalBoard);
              const openBoard = () => {
                if (!canOpenBoard) {
                  return;
                }
                setSelectedMatch(match);
              };

              return (
                <TableRow
                  key={`${match.gameId}-${match.endedAt}`}
                  hover={canOpenBoard}
                  onClick={openBoard}
                  sx={uiSx.historyRow(canOpenBoard)}
                >
                  <TableCell>
                    <Button
                      variant="text"
                      disabled={!canOpenBoard}
                      onClick={(event) => {
                        event.stopPropagation();
                        openBoard();
                      }}
                      sx={uiSx.historyGameIdButton(canOpenBoard)}
                    >
                      {match.gameId}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={uiSx.historyResultBadge(match.result === 'win')}>
                      {resultLabel(match.result)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={uiSx.historyModeBadge(match.mode === 'human_vs_bot')}>
                      {modeLabel(match.mode)}
                    </Box>
                  </TableCell>
                  <TableCell sx={uiSx.historyMutedTextCell}>
                    {formatBotLabel(match.botId)}
                  </TableCell>
                  <TableCell>{match.winnerId ?? '-'}</TableCell>
                  <TableCell>{new Date(match.endedAt).toLocaleString()}</TableCell>
                  <TableCell sx={uiSx.historyActionCell}>
                    <Button
                      variant={canOpenBoard ? 'outlined' : 'text'}
                      size="small"
                      disabled={!canOpenBoard}
                      onClick={(event) => {
                        event.stopPropagation();
                        openBoard();
                      }}
                      sx={uiSx.historyActionButton(canOpenBoard)}
                    >
                      {canOpenBoard ? 'Ver tablero' : 'Sin tablero'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredMatches.length > 0 && (
        <TablePagination
          component="div"
          count={filteredMatches.length}
          page={safePage}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number.parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 20]}
          labelRowsPerPage="Filas por pagina"
          sx={uiSx.historyPagination}
        />
      )}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && openMenuKey)}
        onClose={closeFilterMenu}
        MenuListProps={{ dense: true }}
      >
        {openMenuKey === 'result' &&
          resultFilterOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={filters.result === option.value}
              onClick={() => {
                setFilters((currentFilters) => ({ ...currentFilters, result: option.value }));
                closeFilterMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}

        {openMenuKey === 'mode' &&
          modeFilterOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={filters.mode === option.value}
              onClick={() => {
                setFilters((currentFilters) => ({ ...currentFilters, mode: option.value }));
                closeFilterMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}

        {openMenuKey === 'bot' &&
          botFilterOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={filters.bot === option.value}
              onClick={() => {
                setFilters((currentFilters) => ({ ...currentFilters, bot: option.value }));
                closeFilterMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}

        {openMenuKey === 'winner' &&
          winnerFilterOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={filters.winner === option.value}
              onClick={() => {
                setFilters((currentFilters) => ({ ...currentFilters, winner: option.value }));
                closeFilterMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}

        {openMenuKey === 'date' &&
          dateSortOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={filters.dateSort === option.value}
              onClick={() => {
                setFilters((currentFilters) => ({ ...currentFilters, dateSort: option.value }));
                closeFilterMenu();
              }}
            >
              {option.label}
            </MenuItem>
          ))}
      </Menu>

      <Dialog
        open={Boolean(selectedFinalBoard)}
        onClose={() => setSelectedMatch(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{selectedMatch ? `Tablero final - ${selectedMatch.gameId}` : 'Tablero final'}</DialogTitle>
        <DialogContent dividers>
          {selectedFinalBoard && (
            <Box sx={uiSx.centeredColumn}>
              <Typography variant="body2" color="text.secondary">
                Estado final guardado en el historial de la partida.
              </Typography>

              <Box sx={historyBoardStageSx}>
                <Box sx={uiSx.gameBoardBase} />
                <TriangularBoard
                  board={previewBoard}
                  humanSymbol={selectedFinalBoard.players[0] ?? null}
                  canPlayCell={false}
                  loading={false}
                  playCell={() => undefined}
                  size={selectedFinalBoard.size}
                  winningCellKeys={previewWinningCells}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMatch(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default HistoryView;
