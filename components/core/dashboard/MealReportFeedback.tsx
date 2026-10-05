import { useMutation } from 'convex/react';
import { ThumbsUp, ThumbsDown } from 'phosphor-react-native';
import { useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { checkInStyles as chrome } from '~/components/core/design/CheckInChrome';
import {
  prototypeTypography as type,
  prototypeColors as colors,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc } from '~/convex/_generated/dataModel';

export default function MealReportFeedback({ draft }: { draft: Doc<'coachMealDraftsV1'> }) {
  const submit = useMutation(api.coachMeals.submitReportFeedback);
  const [helpful, setHelpful] = useState<boolean | undefined>(draft.memberHelpful);
  const [correction, setCorrection] = useState(draft.memberCorrection ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(draft.memberHelpful !== undefined);
  const [error, setError] = useState('');
  const save = async () => {
    if (helpful === undefined || busy) return;
    setBusy(true);
    setError('');
    try {
      await submit({ draftId: draft._id, helpful, correction });
      Keyboard.dismiss();
      setSaved(true);
    } catch {
      setError('Could not save feedback. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  if (saved || draft.memberHelpful !== undefined) {
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
                onPress={() => setHelpful(value)}
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
            onChangeText={setCorrection}
            style={[chrome.caption, { marginTop: 0 }]}
          />
          <Text style={type.feedbackCaption}>
            Your feedback is private and shared with the AI to guide future meal reports.
          </Text>
          <PrototypeButton
            label="Send feedback"
            loading={busy}
            onPress={save}
            style={{ marginTop: 4 }}
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[type.error, { marginTop: 8 }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
