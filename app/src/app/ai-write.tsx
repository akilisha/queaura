import { router } from 'expo-router';
import { AiWriter } from '../components/AiWriter';
import { Screen } from '../components/ui';
import { questions } from '../data/db';
import { libraryChanged } from '../data/library';

/** Write questions with AI into the bank (spec §5.3). */
export default function AiWrite() {
  return (
    <Screen form>
      <AiWriter
        saveNote="They go into your questions, ready to use in any game."
        onSaved={(saved) => {
          for (const q of saved) questions.save(q);
          libraryChanged();
          router.back();
        }}
      />
    </Screen>
  );
}
