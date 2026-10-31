import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, opacity, radius, size, space, text, tracking, weight } from '../theme';

// Shared building blocks for host screens.

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

type Tone = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  big,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        big && styles.big,
        styles[tone],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, big && styles.bigLabel, tone === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scroll: { flexGrow: 1 },
  content: { flex: 1, width: '100%', maxWidth: size.contentMax, alignSelf: 'center', padding: space[4], gap: space[4] },
  card: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: size.borderWidth,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  cardTitle: { fontSize: text.sm, fontWeight: weight.semibold, color: color.textMuted, textTransform: 'uppercase', letterSpacing: tracking.caps },
  button: {
    minHeight: size.tapMin,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderWidth: size.borderWidth,
    borderColor: 'transparent',
  },
  big: { minHeight: size.tapMin * 1.5, borderRadius: radius.lg },
  primary: { backgroundColor: color.primary },
  secondary: { backgroundColor: color.surface, borderColor: color.border },
  danger: { backgroundColor: color.danger },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  buttonLabel: { color: color.onPrimary, fontSize: text.md, fontWeight: weight.semibold },
  bigLabel: { fontSize: text.lg, fontWeight: weight.bold },
  secondaryLabel: { color: color.text },
  heading: { fontSize: text.xl, fontWeight: weight.bold, color: color.text },
  muted: { fontSize: text.sm, color: color.textMuted },
  body: { fontSize: text.md, color: color.text },
  error: { fontSize: text.md, color: color.danger },
});
