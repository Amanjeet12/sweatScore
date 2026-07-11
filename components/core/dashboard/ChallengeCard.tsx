import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChallengeCardProps {
  challenge: {
    _id: string;
    name: string;
    createdBy: string;
    coverImageUrl: string | null;
    points: number;
    isLocked: boolean;
    tag?: string;
  };
  completedToday: boolean;
  lastCompletedAt: number | null;

  // This must contain the logged-in user's completions
  // for this particular exercise.
  totalCompletions: number;

  isPremium: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}

function formatLastDone(lastCompletedAt: number | null) {
  if (!lastCompletedAt) return null;

  const now = Date.now();
  const diffMs = Math.max(0, now - lastCompletedAt);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Last done just now';
  if (diffMinutes < 60) return `Last done ${diffMinutes} min ago`;
  if (diffHours < 24) return `Last done ${diffHours}h ago`;
  if (diffDays === 1) return 'Last done 1 day ago';

  return `Last done ${diffDays} days ago`;
}

export default function ChallengeCard({
  challenge,
  completedToday,
  lastCompletedAt,
  totalCompletions,
  isPremium,
  onPress,
  fullWidth = false,
}: ChallengeCardProps) {
  const cooldownHours = completedToday
    ? (() => {
        const now = new Date();
        const midnight = new Date(now);

        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);

        return Math.max(
          1,
          Math.ceil((midnight.getTime() - now.getTime()) / (60 * 60 * 1000))
        );
      })()
    : 0;

  const isLocked = challenge.isLocked && !isPremium;
  const lastDoneText = formatLastDone(lastCompletedAt);

  // 0–29 completions: goal is 30 days
  // 30+ completions: goal becomes 60 days
  const milestoneTarget = totalCompletions < 30 ? 30 : 60;

  // Prevent showing values such as 61/60.
  const milestoneCompleted = Math.min(totalCompletions, milestoneTarget);

  const milestoneProgress = Math.min(
    100,
    (milestoneCompleted / milestoneTarget) * 100
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        width: fullWidth ? '100%' : SCREEN_WIDTH * 0.7,
      }}
      className="overflow-hidden rounded-2xl">
      {challenge.coverImageUrl && (
        <Image
          source={{ uri: challenge.coverImageUrl }}
          style={{
            width: '100%',
            height: undefined,
            aspectRatio: 960 / 516,
          }}
          contentFit="cover"
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '75%',
        }}
      />

      <View className="absolute right-3 top-3 rounded-full bg-primary-500 px-3 py-1">
        <Text className="font-body text-xs font-semibold text-white">
          +{challenge.points} pts
        </Text>
      </View>

      {isLocked && (
        <View
          className="absolute left-3 top-3 items-center justify-center rounded-full px-3 py-1"
          style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}>
          <Text className="font-body text-xs font-bold text-white">
            Pro
          </Text>
        </View>
      )}

      {completedToday && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}>
          <Text className="font-body text-base font-medium text-white">
            Unlocks in  {cooldownHours}h
          </Text>
        </View>
      )}

      <View className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <View className="flex-row items-end justify-between">
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              className="font-heading text-lg font-bold text-white"
              numberOfLines={1}>
              {challenge.name}
            </Text>

            {!!challenge.tag && (
              <Text className="font-body text-sm text-white">
                {challenge.tag}
              </Text>
            )}
          </View>

          <View className="items-end">
            <Text className="font-body text-sm font-bold text-white">
              {milestoneCompleted}/{milestoneTarget} days
            </Text>

            {lastDoneText && (
              <Text className="mt-0.5 font-body text-xs text-white/80">
                {lastDoneText}
              </Text>
            )}
          </View>
        </View>

        {/* Milestone progress bar */}
        <View className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
          <View
            className="h-full rounded-full bg-primary-500"
            style={{
              width: `${milestoneProgress}%`,
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}