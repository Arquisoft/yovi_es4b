import './App.css';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useGamey } from './useGamey';
import { useStats } from './useStats';
import { useAuth } from './hooks/useAuth';
import LoginView from './views/LoginView';
import GameView from './views/GameView';
import SidebarView from './views/SidebarView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import HelpView from './views/HelpView';
import { uiSx } from './theme';

function App() {
  const auth = useAuth();
  const stats = useStats(auth.username ?? undefined);
  const { refreshStats } = stats;
  const lastSyncedFinishedGameRef = useRef<string | null>(null);
  const [restrictedModalOpen, setRestrictedModalOpen] = useState(false);

  const {
    boardSize,
    mode,
    botDifficulty,
    game,
    error,
    loading,
    board,
    canPlayCell,
    setMode,
    setBotDifficulty,
    updateBoardSize,
    createNewGame,
    resignCurrentGame,
    playCell,
  } = useGamey(auth.username ?? undefined);

  const [view, setView] = useState<'login' | 'dashboard' | 'history' | 'game' | 'help'>(auth.isAuthenticated ? 'dashboard' : 'login');

  async function handleCreateNewGame() {
    const created = await createNewGame();
    if (created) {
      setView('game');
    }
  }

  function handleOpenPlay() {
    setView('dashboard');
  }

  function handleOpenStats() {
    if (!auth.isAuthenticated) {
      setRestrictedModalOpen(true);
      return;
    }
    setView('history');
    void refreshStats();
  }

  function handleContinueAsGuest() {
    auth.continueAsGuest();
    setView('dashboard');
  }

  function handleGoToLogin() {
    auth.openLogin();
    setRestrictedModalOpen(false);
    setView('login');
  }

  function handleSessionAction() {
    if (auth.isAuthenticated) {
      auth.logout();
    } else {
      auth.openLogin();
    }
    setView('login');
  }

  useEffect(() => {
    if (!auth.hasSession && view !== 'login') {
      setView('login');
    }
  }, [auth.hasSession, view]);

  useEffect(() => {
    if (!auth.isAuthenticated || !game || !game.game_over) {
      return;
    }

    const finishedGameKey = `${game.game_id}:${game.winner ?? 'none'}`;
    if (lastSyncedFinishedGameRef.current === finishedGameKey) {
      return;
    }

    lastSyncedFinishedGameRef.current = finishedGameKey;
    void refreshStats();
  }, [game, refreshStats]);

  // If auth is still verifying the token, show nothing
  if (auth.loading) return null;

  return (
    <Box sx={uiSx.appShell}>
      <Box sx={uiSx.appHeader}>
        <Box sx={uiSx.appHeaderUserRow}>
          <Typography
            component="button"
            type="button"
            sx={uiSx.appHeaderTitleLink}
            onClick={() => setView(auth.hasSession ? 'dashboard' : 'login')}
          >
            GAME Y
          </Typography>

          {auth.hasSession ? (
            <Box sx={uiSx.appHeaderUserBadge}>
              <Typography component="span" sx={uiSx.appHeaderUserText}>
                Hello,
              </Typography>
              <Typography component="span" sx={uiSx.appHeaderUserName}>
                {auth.displayName}
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Box>

      {view === 'login' ? (
        <Box sx={uiSx.appRoot}>
          <LoginView onNext={() => setView('dashboard')} onAuth={auth.login} onContinueAsGuest={handleContinueAsGuest} />
        </Box>
      ) : (
        <Box sx={uiSx.appBody}>
          <SidebarView
            onOpenPlay={handleOpenPlay}
            onOpenStats={handleOpenStats}
            onOpenHelp={() => setView('help')}
            onSessionAction={handleSessionAction}
            sessionActionLabel={auth.isAuthenticated ? 'Logout' : 'Iniciar sesión'}
            isAuthenticated={auth.isAuthenticated}
          />

          <Box sx={uiSx.appMain}>
            {error && (
              <Alert severity="error" sx={uiSx.errorText}>
                {error}
              </Alert>
            )}

            {auth.isAuthenticated && stats.error && (
              <Alert severity="warning" sx={uiSx.errorText}>
                {stats.error}
              </Alert>
            )}

            {view === 'dashboard' && (
              <DashboardView
                boardSize={boardSize}
                mode={mode}
                botDifficulty={botDifficulty}
                loading={loading}
                setMode={setMode}
                setBotDifficulty={setBotDifficulty}
                updateBoardSize={updateBoardSize}
                createNewGame={handleCreateNewGame}
              />
            )}

            {view === 'history' && auth.isAuthenticated && (
              <HistoryView
                playerStats={stats.playerStats}
                matches={stats.matches}
              />
            )}

            {view === 'help' && <HelpView />}

            {view === 'game' && (
              <GameView
                game={game}
                board={board}
                canPlayCell={canPlayCell}
                loading={loading}
                resignCurrentGame={resignCurrentGame}
                playCell={playCell}
                onBack={() => setView('dashboard')}
              />
            )}
          </Box>
        </Box>
      )}

      <Dialog open={restrictedModalOpen} onClose={() => setRestrictedModalOpen(false)} PaperProps={{ sx: uiSx.accessDialogPaper }}>
        <DialogTitle sx={uiSx.accessDialogTitle}>Registro necesario</DialogTitle>
        <DialogContent sx={uiSx.accessDialogContent}>
          <Typography sx={uiSx.accessDialogText}>
            Las estadisticas solo estan disponibles para cuentas registradas. Si inicias sesion o te registras podremos
            guardar tus partidas y mostrar tu historial.
          </Typography>
        </DialogContent>
        <DialogActions sx={uiSx.accessDialogActions}>
          <Button variant="text" onClick={() => setRestrictedModalOpen(false)}>
            Ahora no
          </Button>
          <Button onClick={handleGoToLogin}>Ir a registro</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
