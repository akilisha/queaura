import { StyleSheet, Text } from 'react-native';
import { color, font, glow, space, text } from '../theme';

/** "Que" in violet, "aura" in gold: the name shows its two halves (spec §2.3). */
export function Logo({ size = 'large' }: { size?: 'small' | 'large' }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel="Queaura" style={[styles.logo, size === 'small' ? styles.small : styles.large]}>
      <Text style={styles.que}>Que</Text>
      <Text style={styles.aura}>aura</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  // Room above and below so the glow is not clipped.
  logo: { fontFamily: font.sign, paddingVertical: space[2], textAlign: 'center' },
  small: { fontSize: text.xl },
  large: { fontSize: text.display },
  que: { color: color.violetLight, ...glow.violetText },
  aura: { color: color.goldLight, ...glow.goldText },
});
