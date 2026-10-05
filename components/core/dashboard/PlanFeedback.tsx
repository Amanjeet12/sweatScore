import { useMutation, useQuery } from 'convex/react';
import { ThumbsDown, ThumbsUp } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
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
      <Text style={[type.feedbackCaption, { color: '#8A8A8A' }]}>
        The more you check in with your coach, the more accurate your plan becomes. Completing your
        profile helps personalise it too.
      </Text>
      <View className="mt-3 flex-row items-center gap-3">
        <Text style={type.feedbackQuestion} className="flex-1">
          Was this helpful?
        </Text>
        {[true, false].map((helpful) => {
          const Icon = helpful ? ThumbsUp : ThumbsDown;
          return (
            <TouchableOpacity
              key={String(helpful)}
              accessibilityRole="button"
              accessibilityLabel={helpful ? 'Plan was helpful' : 'Plan was not helpful'}
              accessibilityState={{
                selected: rating === helpful,
                disabled: busy || rating === undefined,
              }}
              disabled={busy || rating === undefined}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: rating === helpful ? '#FFF3EA' : '#F5F5F5' }}
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
              <Icon
                size={22}
                color={rating === helpful ? '#E8541E' : '#2a2a2a'}
                weight={rating === helpful ? 'fill' : 'regular'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      {rating !== null && rating !== undefined ? (
        <Text
          style={[type.feedbackCaption, { color: '#8A8A8A' }]}
          accessibilityLiveRegion="polite"
          className="mt-2">
          Thanks, your feedback is saved.
        </Text>
      ) : null}
      {error ? (
        <Text style={type.error} accessibilityLiveRegion="polite" className="mt-2">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
