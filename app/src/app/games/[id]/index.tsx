import { router, useLocalSearchParams } from 'expo-router';
import { Field } from '../../../components/form';
import { Card, ErrorText, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader, Stepper } from '../../../components/wizard';
import { plural } from '../../../game/copy';
import { MAX_ROUNDS, MAX_TITLE, titleProblem, withRoundCount } from '../../../game/format';
import { useWizard } from '../../../wizard/draft';

/** Step 1: name and number of rounds. */
export default function NameStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  const problem = titleProblem(draft);
  return (
    <Screen>
      <StepHeader step={1} title="Name your game" intro="A game is made of rounds. Each round has its own style of question." />
      <Card>
        <Field
          label="Game name"
          value={draft.title}
          onChangeText={(title) => setDraft({ ...draft, title })}
          placeholder="Friday pub quiz"
          maxLength={MAX_TITLE}
          autoFocus={!draft.title}
        />
        <Stepper
          label="Rounds"
          value={draft.rounds.length}
          min={1}
          max={MAX_ROUNDS}
          onChange={(n) => setDraft(withRoundCount(draft, n))}
          unit={(n) => plural(n, 'round')}
        />
      </Card>
      <StepFooter>
        {problem && draft.title !== '' && <ErrorText>{problem}</ErrorText>}
        <NextButton onPress={() => router.push(`/games/${id}/rounds`)} disabled={problem !== null} />
      </StepFooter>
    </Screen>
  );
}
