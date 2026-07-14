import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';

type ChallengeRowProps = {
  challenge: Doc<'challenges'> & {
    coverImageUrl: string | null;
  };

  currentTime: number;
};

export default function ChallengeRow({ challenge, currentTime }: ChallengeRowProps) {
  const challengeType = challenge.type ?? 'challenge';

  const typeLabel = challengeType === 'check_in' ? 'Check-In' : 'Challenge';

  const startAt = challenge.dailyStartAt;

  const endAt = challenge.dailyEndAt;

  const hasDailySchedule =
    challenge.isDailyChallenge === true && startAt !== undefined && endAt !== undefined;

  const isCurrentChallenge = hasDailySchedule && startAt <= currentTime && endAt > currentTime;

  const isNextChallenge = hasDailySchedule && startAt > currentTime;

  const isExpiredChallenge = hasDailySchedule && endAt <= currentTime;

  const scheduleLabel = isCurrentChallenge
    ? 'Current Day'
    : isNextChallenge
      ? 'Next Day'
      : isExpiredChallenge
        ? 'Expired'
        : null;

  const scheduleClasses = isCurrentChallenge
    ? {
        container: 'bg-green-100',
        dot: 'bg-green-500',
        text: 'text-green-700',
      }
    : isNextChallenge
      ? {
          container: 'bg-blue-100',
          dot: 'bg-blue-500',
          text: 'text-blue-700',
        }
      : {
          container: 'bg-amber-100',
          dot: 'bg-amber-500',
          text: 'text-amber-700',
        };

  return (
    <View className="flex-row items-center gap-x-4 rounded-lg border border-gray-100 bg-white p-3">
      {challenge.coverImageUrl ? (
        <Image
          source={{
            uri: challenge.coverImageUrl,
          }}
          contentFit="cover"
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
          }}
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-lg bg-gray-200">
          <Text className="text-xs text-gray-400">No image</Text>
        </View>
      )}

      <View className="flex-1 flex-col gap-y-1">
        <Text className="text-lg font-bold text-[#1A1A1A]" numberOfLines={1}>
          {challenge.name}
        </Text>

        <Text className="text-sm font-semibold text-[#313131]">Type: {typeLabel}</Text>

        <View className="flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-primary-100 px-2 py-0.5">
            <Text className="text-xs font-semibold text-primary-600">{challenge.tag}</Text>
          </View>

          <Text className="text-sm text-gray-500">{challenge.points} pts</Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-2">
          <View
            className={`h-2 w-2 rounded-full ${
              challenge.isPublished ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />

          <Text className="text-xs text-gray-500">
            {challenge.isPublished ? 'Published' : 'Draft'}
          </Text>

          {challenge.isLocked && <Text className="text-xs text-amber-600">🔒 Premium</Text>}
        </View>

        {scheduleLabel && (
          <View className="mt-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <View
                className={`flex-row items-center gap-x-1 rounded-full px-2.5 py-1 ${scheduleClasses.container}`}>
                <View className={`h-2 w-2 rounded-full ${scheduleClasses.dot}`} />

                <Text className={`text-xs font-bold ${scheduleClasses.text}`}>{scheduleLabel}</Text>
              </View>

              <View className="rounded-full bg-purple-100 px-2.5 py-1">
                <Text className="text-xs font-semibold text-purple-700">Mode: {typeLabel}</Text>
              </View>
            </View>

            {isCurrentChallenge && endAt && (
              <Text className="mt-1 text-xs text-gray-500">
                Ends: {new Date(endAt).toLocaleString()}
              </Text>
            )}

            {isNextChallenge && startAt && (
              <Text className="mt-1 text-xs text-gray-500">
                Starts: {new Date(startAt).toLocaleString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
