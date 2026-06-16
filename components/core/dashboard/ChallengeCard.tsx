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
  };
  completedToday: boolean;
  lastCompletedAt: number | null;
  totalCompletions: number;
  isPremium: boolean;
  onPress: () => void;
  fullWidth?: boolean;
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
  // Hours until midnight (next day reset)
  const cooldownHours = completedToday
    ? (() => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setDate(midnight.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / (60 * 60 * 1000)));
      })()
    : 0;

  const isLocked = challenge.isLocked && !isPremium;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{ width: fullWidth ? '100%' : SCREEN_WIDTH * 0.7 }}
      className="overflow-hidden rounded-2xl">
      {/* Cover Image */}
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

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '60%',
        }}
      />

      {/* Points badge — top right */}
      <View className="absolute right-3 top-3 rounded-full bg-primary-500 px-3 py-1">
        <Text className="font-body text-xs font-semibold text-white">{challenge.points} pts</Text>
      </View>

      {/* Pro badge — top left */}
      {isLocked && (
        <View
          className="absolute left-3 top-3 items-center justify-center rounded-full px-3 py-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Text className="font-body text-xs font-bold text-white">Pro</Text>
        </View>
      )}

      {/* Cooldown overlay — center with dark scrim */}
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
            Available in {cooldownHours}h
          </Text>
        </View>
      )}

      {/* Bottom content */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <View className="flex-row items-end justify-between">
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text className="font-heading text-lg font-bold text-white" numberOfLines={1}>
              {challenge.name}
            </Text>
            <Text className="font-body text-sm text-white">with {challenge.createdBy}</Text>
          </View>
          <Text className="font-body text-sm text-white">{totalCompletions} completed</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
