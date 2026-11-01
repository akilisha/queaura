import { Children, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, glow, opacity, radius, size, space, text, tracking } from '../theme';

// Shared building blocks for host screens.

/** [form] keeps forms and reading screens narrower on a tablet. */
export function Screen({ children, scroll = true, form = false }: { children: ReactNode; scroll?: boolean; form?: boolean }) {
  const body = <View style={[styles.content, form && styles.form]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

/** Lists of cards: two columns on a tablet, one on a phone. */
export function Grid({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < size.wide) return <>{children}</>;
  return (
    <View style={styles.grid}>
      {Children.map(children, (child) => (child ? <View style={styles.gridItem}>{child}</View> : null))}
    </View>
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
      <Text style={[styles.buttonLabel, tone !== 'secondary' && styles.signLabel, big && styles.bigLabel, styles[`${tone}Label`]]}>{label}</Text>
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
  form: { maxWidth: size.formMax },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  // Two per row with the gap between; a lone last card keeps the same width.
  gridItem: { flexBasis: '45%', flexGrow: 1, maxWidth: '48%' },
  content: { flex: 1, width: '100%', maxWidth: size.contentMax, alignSelf: 'center', padding: space[4], gap: space[4] },
  card: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: size.borderWidth,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  cardTitle: { fontFamily: font.displayBold, fontSize: text.lg, color: color.violet, textTransform: 'uppercase', letterSpacing: tracking.caps },
  button: {
    minHeight: size.tapMin,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderWidth: size.borderStrong,
    borderColor: 'transparent',
  },
  big: { minHeight: size.tapMin * 1.4, borderRadius: radius.lg },
  // The gold sign: the one action that matters on a screen.
  primary: { backgroundColor: color.primary, ...glow.gold },
  // Neon outline on the wall.
  secondary: { backgroundColor: 'transparent', borderColor: color.violet, ...glow.violet },
  danger: { backgroundColor: color.danger },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  buttonLabel: { fontFamily: font.bodyBold, fontSize: text.md },
  signLabel: { fontFamily: font.display, fontSize: text.lg, textTransform: 'uppercase', letterSpacing: tracking.caps },
  bigLabel: { fontSize: text.xl },
  primaryLabel: { color: color.onPrimary },
  secondaryLabel: { color: color.violetLight },
  dangerLabel: { color: color.onDanger },
  heading: { fontFamily: font.bodyBold, fontSize: text.xl, color: color.text },
  muted: { fontFamily: font.body, fontSize: text.sm, color: color.textMuted },
  body: { fontFamily: font.body, fontSize: text.md, color: color.text },
  error: { fontFamily: font.bodySemi, fontSize: text.md, color: color.danger },
});
