import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { uiSx } from '../theme';
import { botHistoryLabels, type MatchHistoryItem, type PlayerStatsSummary } from '../stats/types';

type Props = {
  playerStats: PlayerStatsSummary;
  matches: MatchHistoryItem[];
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  if (mode === 'human_vs_bot') return 'Bot';
  if (mode === 'human_vs_human') return 'Humano';
  return '-';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

const HistoryView: React.FC<Props> = ({ playerStats, matches }) => {
  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryItem | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const selectedFinalBoard = selectedMatch?.finalBoard ?? null;
  const winRate = playerStats.totalGames > 0 ? Math.round((playerStats.victories / playerStats.totalGames) * 100) : 0;
  const updatedAtText = playerStats.updatedAt
    ? new Date(playerStats.updatedAt).toLocaleDateString()
    : 'Sin partidas';

  const previewBoard = useMemo(
    () => (selectedFinalBoard ? toBoardCellsFromYen(selectedFinalBoard) : []),
    [selectedFinalBoard],
  );

  const previewWinningCells = useMemo(
    () => (selectedFinalBoard ? findWinningConnectionCellKeysFromBoard(selectedFinalBoard) : new Set<string>()),
    [selectedFinalBoard],
  );

  const paginatedMatches = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return matches.slice(start, end);
  }, [matches, page, rowsPerPage]);

  const maxPage = matches.length > 0 ? Math.ceil(matches.length / rowsPerPage) - 1 : 0;
  const safePage = Math.min(page, maxPage);

  useEffect(() => {
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const historyBoardStageSx = {
    ...uiSx.gameBoardStage,
    transform: 'none',
    mt: 0.8,
    mb: 0.8,
    px: { xs: 2.6, sm: 4.4 },
    pt: { xs: 3, sm: 4.2 },
    pb: { xs: 2, sm: 2.8 },
  };

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
        Pulsa en una fila o en "Ver tablero" para revisar el estado final.
      </Typography>

      <TableContainer sx={uiSx.historyTableContainer}>
        <Table size="small" stickyHeader sx={uiSx.historyTable}>
          <TableHead>
            <TableRow>
              <TableCell sx={uiSx.historyTableHeadCell}>Partida</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>Resultado</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>Modo</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>Bot</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>Ganador</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell}>Fecha</TableCell>
              <TableCell sx={uiSx.historyTableHeadCell} align="right">
                Accion
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>Todavia no hay partidas registradas.</TableCell>
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
                    {match.botId ? botHistoryLabels[match.botId] ?? match.botId : '-'}
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

      {matches.length > 0 && (
        <TablePagination
          component="div"
          count={matches.length}
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
