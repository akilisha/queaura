import { discardPending, savePending, summary, usePendingResults } from '../results/store';
import { useConfirm } from './ConfirmDialog';
import { Body, Button, Card, Muted } from './ui';

/**
 * Save or discard a questionnaire's answers (spec §6.4). Shown when the host ends one, and on the
 * next launch for answers left behind if the app stopped before the host chose (crash recovery).
 * One at a time, oldest first. Discarding asks twice: it cannot be undone.
 */
export function PendingResults() {
  const [dialog, confirm] = useConfirm();
  const pending = usePendingResults();
  const next = pending[0];
  if (!next) return null;
  const r = next.result;

  const discard = () =>
    confirm({
      title: 'Discard these answers?',
      message: r ? `${summary(r)} They will be deleted from this phone.` : 'They will be deleted from this phone.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep them',
      danger: true,
      onConfirm: () =>
        confirm({
          title: 'Delete them for good?',
          message: 'This cannot be undone.',
          confirmLabel: 'Delete for good',
          cancelLabel: 'Keep them',
          danger: true,
          onConfirm: () => discardPending(next),
        }),
    });

  return (
    <Card title={r ? `Answers to "${r.title}"` : 'Questionnaire answers'}>
      {dialog}
      {r ? <Body>{summary(r)}</Body> : <Body>These answers could not be read.</Body>}
      {r && r.endedAt === null && <Muted>The app stopped before you chose what to do with them. Everything answered up to then was kept.</Muted>}
      {r && <Button big label="Save results" onPress={() => savePending(next)} />}
      <Button tone="secondary" label="Discard" onPress={discard} />
      {pending.length > 1 && <Muted>{pending.length - 1} more after this one.</Muted>}
    </Card>
  );
}
