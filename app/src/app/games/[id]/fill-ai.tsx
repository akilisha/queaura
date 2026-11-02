import { router } from 'expo-router';
import { AiFill } from '../../../components/AiFill';
import { Screen } from '../../../components/ui';
import { useWizard } from '../../../wizard/draft';

/** Fills every empty slot in the game being edited with AI questions (spec §5.2). */
export default function FillWithAi() {
  const { draft, setDraft } = useWizard();
  return (
    <Screen form>
      <AiFill
        game={draft}
        topic={draft.title}
        onSaved={(filled) => {
          setDraft(filled);
          router.back();
        }}
      />
    </Screen>
  );
}
