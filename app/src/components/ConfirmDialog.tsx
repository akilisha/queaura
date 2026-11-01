import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, size, space, text } from '../theme';
import { Button } from './ui';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get the danger color. */
  danger?: boolean;
  onConfirm: () => void;
}

/** An in-app confirmation styled like the rest of the app, instead of the system alert box. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cancel">
        {request && (
          // Taps inside the card must not fall through to the scrim.
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            <Text style={styles.title}>{request.title}</Text>
            <Text style={styles.message}>{request.message}</Text>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button tone="secondary" label={request.cancelLabel ?? 'Cancel'} onPress={onClose} />
              </View>
              <View style={styles.action}>
                <Button
                  tone={request.danger ? 'danger' : 'primary'}
                  label={request.confirmLabel}
                  onPress={() => {
                    onClose();
                    request.onConfirm();
                  }}
                />
              </View>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

/** `const [dialog, confirm] = useConfirm()`: render `dialog`, call `confirm({...})` to ask. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback((r: ConfirmRequest) => setRequest(r), []);
  const dialog = <ConfirmDialog request={request} onClose={() => setRequest(null)} />;
  return [dialog, confirm] as const;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  card: {
    width: '100%',
    maxWidth: size.dialogMax,
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: size.borderWidth,
    borderRadius: radius.lg,
    padding: space[5],
    gap: space[3],
  },
  title: { fontFamily: font.display, fontSize: text.xl, textTransform: 'uppercase', color: color.text },
  message: { fontFamily: font.body, fontSize: text.md, color: color.textMuted },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[2] },
  action: { flex: 1 },
});
