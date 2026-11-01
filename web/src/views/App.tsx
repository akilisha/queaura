import * as store from '../state/store';
import { InterludeView } from './InterludeView';
import { JoinView } from './JoinView';
import { LobbyView } from './LobbyView';
import { NoticeView } from './NoticeView';
import { QuestionnaireView } from './QuestionnaireView';
import { QuestionView } from './QuestionView';
import { RevealView } from './RevealView';
import { ScoresView } from './ScoresView';

/** Picks the view from the seat and the game phase (see COMPONENTS.md). */
export function App() {
  const isPlayer = store.mode.value === 'player';
  if (store.kicked.value) return <NoticeView title="You've been removed" message="The host removed you from this game." />;
  if (store.connection.value === 'replaced') {
    return <NoticeView title="Opened elsewhere" message="This game is open in another tab. Use that one, or reload this page." />;
  }
  const phase = store.phase.value;
  if (store.sessionEnded.value || phase === 'ended') return <NoticeView title="Thanks for playing!" message="The host has ended this session." />;
  if (isPlayer && store.playerId.value === null) {
    return store.needsJoin.value ? <JoinView /> : <NoticeView title="Finding your seat…" message="Connecting to the game." />;
  }
  switch (phase) {
    case null:
      return <NoticeView title="Finding your seat…" message="Connecting to the game." />;
    case 'lobby':
      return <LobbyView />;
    case 'gameStarting':
    case 'roundIntro':
      return <InterludeView />;
    case 'question':
    case 'timesUp':
      return <QuestionView />;
    case 'reveal':
      return <RevealView />;
    case 'questionnaire':
      return <QuestionnaireView />;
    case 'roundScores':
    case 'roundBreak':
    case 'finalScores':
      return <ScoresView />;
  }
}
