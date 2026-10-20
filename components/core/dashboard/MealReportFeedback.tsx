import { useMutation } from 'convex/react';
import { ThumbsUp, ThumbsDown } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { checkInStyles as chrome } from '~/components/core/design/CheckInChrome';
import {
  prototypeTypography as type,
  prototypeColors as colors,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
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
  const submit = useMutation(api.coachMeals.submitReportFeedback);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const helpful = value.helpful ?? draft.memberHelpful;
  const correction = value.correction;
  const save = async (helpful: boolean, correction: string) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await submit({ draftId: draft._id, helpful, correction });
    } catch {
      setError('Your feedback could not be saved. Tap your rating to retry.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
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
                disabled={busy || saving}
                accessibilityRole="button"
                accessibilityLabel={value ? 'Helpful' : 'Not helpful'}
                accessibilityState={{ selected, disabled: busy || saving }}
                onPress={() => {
                  const nextCorrection = value ? '' : correction;
                  onChange({ helpful: value, correction: nextCorrection });
                  save(value, nextCorrection).catch(() => {});
                }}
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
      {helpful === false ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <TextInput
            accessibilityLabel="Meal analysis feedback"
            placeholder="What did we miss? (optional)"
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={500}
            editable={!busy && !saving}
            value={correction}
            onEndEditing={() => {
              if (helpful === false) save(false, correction).catch(() => {});
            }}
            onChangeText={(correction) => onChange({ helpful, correction })}
            style={[chrome.caption, { marginTop: 0 }]}
          />
          <Text style={type.feedbackCaption}>
            Your feedback is private and shared with your AI coach to guide future meal reports.
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={type.error}>
          {error}
        </Text>
      ) : draft.memberHelpful !== undefined ? (
        <Text style={[type.feedbackCaption, { marginTop: 12 }]}>Feedback saved. Thank you!</Text>
      ) : null}
    </View>
  );
}
