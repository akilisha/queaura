import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, glow, opacity, radius, size, space, text, tracking } from '../theme';
import { kindOf } from '../game/format';
import { useWizard } from '../wizard/draft';
import { Button } from './ui';

// Pieces every wizard step shares: where you are, the step's content, and how to move on.

/** A questionnaire has no rounds or scoring to set up, so it skips those steps (spec §6.4). */
export const STEPS = {
  quiz: ['Name', 'Rounds', 'Scoring', 'Questions', 'Summary'],
  questionnaire: ['Name', 'Questions', 'Summary'],
} as const;

export type StepName = (typeof STEPS.quiz)[number];

export function StepHeader({ name, title, intro }: { name: StepName; title: string; intro?: string }) {
  const { draft } = useWizard();
  const steps: readonly StepName[] = STEPS[kindOf(draft)];
  const step = steps.indexOf(name) + 1;
  return (
    <View style={styles.header}>
      <View style={styles.progress} accessibilityLabel={`Step ${step} of ${steps.length}`}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.dot, i < step && styles.dotDone]} />
        ))}
      </View>
      <Text style={styles.step}>
        Step {step} of {steps.length}
      </Text>
      <Text style={styles.title}>{title}</Text>
      {intro && <Text style={styles.intro}>{intro}</Text>}
    </View>
  );
}

export function StepFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export function NextButton({ label = 'Next', onPress, disabled }: { label?: string; onPress: () => void; disabled?: boolean }) {
  return <Button big label={label} onPress={onPress} disabled={disabled} />;
}

/** − value + for small whole numbers. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: (n: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <StepperButton symbol="−" label={`Fewer ${label.toLowerCase()}`} onPress={() => onChange(value - 1)} disabled={value <= min} />
        <Text style={styles.stepperValue} accessibilityLiveRegion="polite">
          {unit ? unit(value) : value}
        </Text>
        <StepperButton symbol="+" label={`More ${label.toLowerCase()}`} onPress={() => onChange(value + 1)} disabled={value >= max} />
      </View>
    </View>
  );
}

function StepperButton({ symbol, label, onPress, disabled }: { symbol: string; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.stepperSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[2], paddingTop: space[2] },
  progress: { flexDirection: 'row', gap: space[2] },
  dot: { flex: 1, height: space[1], borderRadius: radius.pill, backgroundColor: color.border },
  dotDone: { backgroundColor: color.gold, ...glow.gold },
  step: { fontFamily: font.displayBold, fontSize: text.md, letterSpacing: tracking.caps, textTransform: 'uppercase', color: color.violet },
  title: { fontFamily: font.display, fontSize: text.xxl, lineHeight: text.xxl * 1.05, textTransform: 'uppercase', color: color.text },
  intro: { fontFamily: font.body, fontSize: text.md, color: color.textMuted },
  footer: { gap: space[3], paddingBottom: space[4] },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  stepperLabel: { flex: 1, fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stepperButton: {
    width: size.tapMin,
    height: size.tapMin,
    borderRadius: radius.pill,
    borderWidth: size.borderWidth,
    borderColor: color.violet,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: { fontFamily: font.display, fontSize: text.xl, color: color.violetLight },
  stepperValue: { minWidth: size.numberColumn, textAlign: 'center', fontFamily: font.display, fontSize: text.xl, color: color.gold, ...glow.softGoldText },
  pressed: { backgroundColor: color.surfaceRaised },
  disabled: { opacity: opacity.disabled },
});
