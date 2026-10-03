import { useMutation, useQuery } from 'convex/react';
import { ThumbsDown, ThumbsUp } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function PlanFeedback({ revisionId }: { revisionId: Id<'coachPlanRevisionsV1'> }) {
  const rating = useQuery(api.coachDailyService.myPlanFeedback, { revisionId });
  const save = useMutation(api.coachDailyService.ratePlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <View className="my-4">
      <Text className="font-body text-sm leading-5 text-[#77716D]">
        The more you check in with your coach, the more accurate your plan becomes. Completing your
        profile helps personalise it too.
      </Text>
      <View className="mt-3 flex-row items-center gap-3">
        <Text className="flex-1 font-body text-base">Was this helpful?</Text>
        {[true, false].map((helpful) => {
          const Icon = helpful ? ThumbsUp : ThumbsDown;
          return (
            <TouchableOpacity
              key={String(helpful)}
              accessibilityRole="button"
              accessibilityLabel={helpful ? 'Plan was helpful' : 'Plan was not helpful'}
              accessibilityState={{ selected: rating === helpful, disabled: busy }}
              disabled={busy || rating === undefined}
              className="h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: rating === helpful ? '#FFE2D2' : '#F5F2EF' }}
              onPress={async () => {
                setBusy(true);
                setError('');
                try {
                  await save({ revisionId, helpful });
                } catch {
                  setError('Could not save your feedback. Please try again.');
                } finally {
                  setBusy(false);
                }
              }}>
              <Icon size={24} color="#E9512A" weight={rating === helpful ? 'fill' : 'regular'} />
            </TouchableOpacity>
          );
        })}
      </View>
      {rating !== null && rating !== undefined ? (
        <Text accessibilityLiveRegion="polite" className="mt-2 text-sm text-[#77716D]">
          Thanks, your feedback is saved.
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" className="mt-2 text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
