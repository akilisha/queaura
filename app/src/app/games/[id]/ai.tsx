import { router, useLocalSearchParams } from 'expo-router';
import { AiWriter } from '../../../components/AiWriter';
import { Muted, Screen } from '../../../components/ui';
import { answerTypeFor } from '../../../ai/write';
import { questions } from '../../../data/db';
import { libraryChanged, useLibrary } from '../../../data/library';
import { withSlot } from '../../../game/format';
import { useWizard } from '../../../wizard/draft';

/** Fills a round's empty slots with AI questions that fit its style (spec §5.3). */
export default function FillWithAi() {
  const round = Number(useLocalSearchParams<{ round: string }>().round);
  const { draft, setDraft } = useWizard();
  const library = useLibrary();
  const r = draft.rounds[round];
  const empty = r ? r.slots.flatMap((id, i) => (id === null || !library.byId.has(id) ? [i] : [])) : [];
  if (empty.length === 0) {
    return (
      <Screen form>
        <Muted>Every slot in this round is filled.</Muted>
      </Screen>
    );
  }
  return (
    <Screen form>
      <AiWriter
        count={empty.length}
        answerType={answerTypeFor(r.style)}
        topic={draft.title}
        saveLabel={(n) => `Put ${n} ${n === 1 ? 'question' : 'questions'} in the round`}
        saveNote="They're also saved to your questions, so you keep them even if you don't save this game."
        onSaved={(saved) => {
          for (const q of saved) questions.save(q);
          libraryChanged();
          let next = draft;
          saved.forEach((q, i) => (next = withSlot(next, round, empty[i], q.id)));
          setDraft(next);
          router.back();
        }}
      />
    </Screen>
  );
}
