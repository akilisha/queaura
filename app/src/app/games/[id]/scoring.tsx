import { router, useLocalSearchParams } from 'expo-router';
import type { Scoring } from '../../../../../protocol/src';
import { OptionCard } from '../../../components/form';
import { Card, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader } from '../../../components/wizard';
import { CLOSE_EARLY, SCORINGS } from '../../../game/copy';
import { useWizard } from '../../../wizard/draft';

const SCORING_ORDER: Scoring[] = ['allOrNothing', 'timeWeighted', 'none'];

/** Step 3: how points work, and when a question ends. */
export default function ScoringStep() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, setDraft } = useWizard();
  return (
    <Screen>
      <StepHeader step={3} title="Scoring" intro="This applies to every round in the game." />
      <Card title="Points">
        {SCORING_ORDER.map((s) => (
          <OptionCard
            key={s}
            title={SCORINGS[s].name}
            description={SCORINGS[s].description}
            selected={draft.scoring === s}
            onPress={() => setDraft({ ...draft, scoring: s })}
          />
        ))}
      </Card>
      <Card title="A question ends">
        <OptionCard
          title={CLOSE_EARLY.off.name}
          description={CLOSE_EARLY.off.description}
          selected={!draft.closeEarly}
          onPress={() => setDraft({ ...draft, closeEarly: false })}
        />
        <OptionCard
          title={CLOSE_EARLY.on.name}
          description={CLOSE_EARLY.on.description}
          selected={!!draft.closeEarly}
          onPress={() => setDraft({ ...draft, closeEarly: true })}
        />
      </Card>
      <StepFooter>
        <NextButton onPress={() => router.push(`/games/${id}/slots`)} />
      </StepFooter>
    </Screen>
  );
}
