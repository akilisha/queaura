import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { color, font, glow, opacity, radius, size, space, text } from '../theme';

// Form controls shared by the question editor and the game wizard.

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  maxLength,
  multiline,
  keyboardType,
  autoFocus,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        accessibilityLabel={label}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

/** A choice explained in plain language (spec §5.2: every choice says what it does). */
export function OptionCard({
  title,
  description,
  selected,
  onPress,
  disabledReason,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  /** Invalid options stay visible, greyed out, with the reason (spec §5.2). */
  disabledReason?: string;
}) {
  const disabled = disabledReason !== undefined;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.hint}>{disabledReason ?? description}</Text>
      </View>
    </Pressable>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.chip, o.value === value && styles.chipSelected]}
        >
          <Text style={[styles.chipLabel, o.value === value && styles.chipLabelSelected]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  label: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  input: {
    minHeight: size.tapMin,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderWidth: size.borderWidth,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    fontFamily: font.body, fontSize: text.md,
    color: color.text,
  },
  multiline: { minHeight: size.tapMin * 2, textAlignVertical: 'top' },
  hint: { fontFamily: font.body, fontSize: text.sm, color: color.textMuted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderWidth: size.borderStrong,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  optionSelected: { borderColor: color.gold, backgroundColor: color.surfaceRaised, ...glow.gold },
  optionDisabled: { opacity: opacity.disabled },
  radio: { width: size.radio, height: size.radio, borderRadius: radius.pill, borderWidth: size.radioBorder, borderColor: color.border },
  radioSelected: { borderColor: color.gold, backgroundColor: color.gold },
  optionText: { flex: 1, gap: space[1] },
  optionTitle: { fontSize: text.md, fontFamily: font.bodySemi, color: color.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    borderWidth: size.borderWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipSelected: { backgroundColor: color.gold, borderColor: color.gold },
  chipLabel: { fontSize: text.sm, fontFamily: font.bodySemi, color: color.text },
  chipLabelSelected: { color: color.onGold },
});
