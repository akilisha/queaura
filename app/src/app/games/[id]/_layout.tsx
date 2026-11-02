import { router, Stack, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useLibrary } from '../../../data/library';
import { newGame, newGameId } from '../../../game/format';
import { color, font, text } from '../../../theme';
import { WizardProvider, useWizard } from '../../../wizard/draft';

/** The game wizard (spec §5.2). `/games/new` creates a game; `/games/<id>` edits one. */
export default function WizardLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const library = useLibrary();
  const existing = id === 'new' ? undefined : library.games.find((g) => g.id === id);
  // Read once: later library changes (a question written mid-wizard) must not reset the draft.
  const [initial] = useState(() => existing ?? newGame(newGameId()));
  return (
    <WizardProvider initial={initial} isNew={!existing}>
      <WizardStack />
    </WizardProvider>
  );
}

function WizardStack() {
  const { dirty, isNew, closing, discard } = useWizard();
  const [dialog, confirm] = useConfirm();
  const title = isNew ? 'NEW GAME' : 'EDIT GAME';

  // Leaving with unsaved changes asks first; the draft is never saved by accident.
  usePreventRemove(dirty, ({ repeat }) =>
    confirm({
      title: isNew ? 'Discard this game?' : 'Discard your changes?',
      message: 'Nothing has been saved yet. Save it from the summary step to keep it.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      danger: true,
      // Carry on with the navigation that was held back (back button, gesture, header arrow).
      // repeat() lifts the guard before re-sending it; re-sending it directly would be held back
      // again and reopen this dialog.
      onConfirm: () => {
        discard();
        repeat();
      },
    }),
  );

  // After saving, go to the game list once the "unsaved" guard has been lifted.
  useEffect(() => {
    if (closing && !dirty) router.dismissTo('/games');
  }, [closing, dirty]);

  const options = useMemo(
    () => ({
      headerStyle: { backgroundColor: color.bg },
      headerTintColor: color.violetLight,
      headerTitleStyle: { fontFamily: font.display, fontSize: text.xl, color: color.text },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: color.bg },
      title,
    }),
    [title],
  );

  return (
    <>
      <Stack screenOptions={options}>
        <Stack.Screen name="pick" options={{ title: 'CHOOSE A QUESTION', presentation: 'modal' }} />
        <Stack.Screen name="fill-ai" options={{ title: 'FILL WITH AI' }} />
      </Stack>
      {dialog}
    </>
  );
}
