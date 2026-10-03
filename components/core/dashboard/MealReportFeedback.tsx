import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

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
      <View className="mt-4 border-t border-[#E8E2DE] pt-4">
        <Text accessibilityLiveRegion="polite" className="text-sm text-[#47704D]">
          Feedback submitted. Thank you!
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-4 border-t border-[#E8E2DE] pt-4">
      <Text className="font-heading text-sm font-semibold">Was this analysis helpful?</Text>
      <View className="mt-2 flex-row gap-2">
        {[true, false].map((value) => (
          <Pressable
            key={String(value)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: helpful === value }}
            onPress={() => {
              setHelpful(value);
            }}
            className={`rounded-full border px-4 py-2 ${helpful === value ? 'border-[#FF5C35] bg-[#FFF0E8]' : 'border-[#DDD7D2] bg-white'}`}>
            <Text>{value ? 'Helpful' : 'Not helpful'}</Text>
          </Pressable>
        ))}
      </View>
      {helpful !== undefined ? (
        <>
          <TextInput
            accessibilityLabel="Meal analysis feedback"
            placeholder="What did we get right or miss? (optional)"
            multiline
            maxLength={500}
            editable={!busy}
            value={correction}
            onChangeText={setCorrection}
            className="mt-3 min-h-20 rounded-xl bg-white p-3"
          />
          <Text className="mt-2 font-body text-xs text-[#77716D]">
            Your feedback is private and shared with the AI to guide future meal reports.
          </Text>
          <Pressable
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            className="mt-3 items-center rounded-full bg-[#FF5C35] py-3">
            <Text className="font-heading text-sm text-white">
              {busy ? 'Saving…' : 'Send feedback'}
            </Text>
          </Pressable>
        </>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="mt-2 text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
