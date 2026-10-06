import { ThumbsUp, ThumbsDown } from 'phosphor-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { checkInStyles as chrome } from '~/components/core/design/CheckInChrome';
import {
  prototypeTypography as type,
  prototypeColors as colors,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';
import type { MealFeedbackInput } from '~/shared/coachMealFlow';

export default function MealReportFeedback({
  draft,
  value,
  onChange,
  busy,
}: {
  draft: Doc<'coachMealDraftsV1'>;
  value: MealFeedbackInput;
  onChange: (value: MealFeedbackInput) => void;
  busy: boolean;
}) {
  const { helpful, correction } = value;
  if (draft.memberHelpful !== undefined) {
    return (
      <Text
        accessibilityLiveRegion="polite"
        style={[type.supporting, { marginTop: 20, color: '#47704d' }]}>
        Feedback submitted. Thank you!
      </Text>
    );
  }
  return (
    <View style={{ marginTop: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
        <Text style={[type.feedbackQuestion, { flexShrink: 1 }]}>Was this analysis helpful?</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[true, false].map((value) => {
            const Icon = value ? ThumbsUp : ThumbsDown;
            const selected = helpful === value;
            return (
              <Pressable
                key={String(value)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={value ? 'Helpful' : 'Not helpful'}
                accessibilityState={{ selected, disabled: busy }}
                onPress={() => onChange({ helpful: value, correction })}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.selected : colors.secondary,
                  opacity: busy ? 0.6 : 1,
                }}>
                <Icon size={22} color={selected ? colors.icon : colors.ink} />
              </Pressable>
            );
          })}
        </View>
      </View>
      {helpful !== undefined ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <TextInput
            accessibilityLabel="Meal analysis feedback"
            placeholder="What did we get right or miss? (optional)"
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={500}
            editable={!busy}
            value={correction}
            onChangeText={(correction) => onChange({ helpful, correction })}
            style={[chrome.caption, { marginTop: 0 }]}
          />
          <Text style={type.feedbackCaption}>
            Your feedback is private and shared with your AI coach to guide future meal reports.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
