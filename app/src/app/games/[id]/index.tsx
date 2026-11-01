import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Field, OptionCard } from '../../../components/form';
import { Card, ErrorText, Muted, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader, Stepper } from '../../../components/wizard';
import { useLibrary } from '../../../data/library';
import { blockedMessage, KINDS, plural } from '../../../game/copy';
import GameServer from '../../../../modules/game-server/src/GameServerModule';
import { kindOf, MAX_ROUNDS, MAX_TITLE, maxQuestions, titleProblem, withKind, withQuestionCount, withRoundCount, type GameKind } from '../../../game/format';
import { useWizard } from '../../../wizard/draft';

const KIND_ORDER: GameKind[] = ['quiz', 'questionnaire'];

/** Step 1: name, quiz or questionnaire, and how big it is. */
export default function NameStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  // Questions without a right answer taken out by switching back to a quiz, so the host is told.
  const [cleared, setCleared] = useState(0);
  const blocked = draft.title.trim() ? GameServer.findBlocked(draft.title) : null;
  const problem = titleProblem(draft) ?? (blocked ? blockedMessage(blocked, 'game names') : null);
  const kind = kindOf(draft);

  const chooseKind = (next: GameKind) => {
    const result = withKind(draft, next, library.byId);
    setDraft(result.game);
    setCleared(result.cleared);
  };

  return (
    <Screen>
      <StepHeader
        name="Name"
        title="Name your game"
        intro={kind === 'quiz' ? 'A quiz is made of rounds. Each round has its own style of question.' : 'A questionnaire is one set of questions that everyone answers in their own time.'}
      />
      <Card>
        <Field
          label="Game name"
          value={draft.title}
          onChangeText={(title) => setDraft({ ...draft, title })}
          placeholder={kind === 'quiz' ? 'Friday pub quiz' : 'Team feedback'}
          maxLength={MAX_TITLE}
          autoFocus={!draft.title}
        />
      </Card>
      <Card title="What kind of game?">
        {KIND_ORDER.map((k) => (
          <OptionCard key={k} title={KINDS[k].name} description={KINDS[k].description} selected={kind === k} onPress={() => chooseKind(k)} />
        ))}
        {cleared > 0 && (
          <Muted>
            {plural(cleared, 'question')} without a right answer {cleared === 1 ? 'was' : 'were'} taken out: {cleared === 1 ? 'it fits' : 'they fit'} questionnaires only.
          </Muted>
        )}
        {kind === 'quiz' ? (
          <Stepper
            label="Rounds"
            value={draft.rounds.length}
            min={1}
            max={MAX_ROUNDS}
            onChange={(n) => setDraft(withRoundCount(draft, n))}
            unit={(n) => plural(n, 'round')}
          />
        ) : (
          <Stepper
            label="Questions"
            value={draft.rounds[0].slots.length}
            min={1}
            max={maxQuestions(draft)}
            onChange={(n) => setDraft(withQuestionCount(draft, 0, n))}
          />
        )}
      </Card>
      <StepFooter>
        {problem && draft.title !== '' && <ErrorText>{problem}</ErrorText>}
        <NextButton onPress={() => router.push(`/games/${id}/${kind === 'quiz' ? 'rounds' : 'slots'}`)} disabled={problem !== null} />
      </StepFooter>
    </Screen>
  );
}
