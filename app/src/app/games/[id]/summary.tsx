import { StyleSheet, Text } from 'react-native';
import { Card, Screen } from '../../../components/ui';
import { NextButton, StepFooter, StepHeader } from '../../../components/wizard';
import { useLibrary } from '../../../data/library';
import { describe } from '../../../game/format';
import { problemOf } from '../../../game/resolve';
import { color, font, space, text } from '../../../theme';
import { useWizard } from '../../../wizard/draft';

/** Step 5: every choice restated in plain language before saving (spec §5.2). */
export default function SummaryStep() {
  const { draft, saveAndClose } = useWizard();
  const library = useLibrary();
  const { lines, status } = describe(draft, library.byId);
  const ready = problemOf(draft, library.byId) === null;
  return (
    <Screen>
      <StepHeader name="Summary" title="Check and save" />
      <Card>
        {lines.map((line, i) => (
          <Text key={i} style={i === 0 ? styles.first : styles.line}>
            {line}
          </Text>
        ))}
      </Card>
      <Card>
        <Text style={ready ? styles.ready : styles.notReady}>{status}</Text>
      </Card>
      <StepFooter>
        <NextButton label="Save game" onPress={saveAndClose} />
      </StepFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  first: { fontSize: text.lg, fontFamily: font.bodyBold, color: color.text, marginBottom: space[1] },
  line: { fontFamily: font.body, fontSize: text.md, color: color.text },
  ready: { fontSize: text.md, fontFamily: font.bodySemi, color: color.success },
  notReady: { fontSize: text.md, fontFamily: font.bodySemi, color: color.warning },
});
