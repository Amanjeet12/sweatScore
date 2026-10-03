import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { pointsLabel } from '~/shared/pointsLabel';

export default function CommunityChallengeCard({
  challenge,
  onPress,
}: {
  challenge: any;
  onPress: () => void;
}) {
  const completedToday = challenge.isJoined && challenge.completedToday;
  const availabilityLabel =
    challenge.currentDay >= challenge.durationDays
      ? 'Challenge complete'
      : challenge.nextAvailableAt
        ? `Available in ${Math.max(1, Math.ceil((challenge.nextAvailableAt - Date.now()) / 3600000))}h`
        : 'Available tomorrow';
  const statusLabel = challenge.isJoined
    ? `${challenge.completedDays} of ${challenge.durationDays} days complete`
    : challenge.status === 'upcoming'
      ? challenge.daysUntilStart === 1
        ? 'Starts tomorrow'
        : `Starts in ${challenge.daysUntilStart} days`
      : challenge.status === 'ended'
        ? 'Challenge ended'
        : `Day ${Math.max(1, challenge.currentDay)}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={completedToday}
      accessibilityRole="button"
      accessibilityState={{ disabled: completedToday }}
      accessibilityLabel={`${challenge.name}, ${statusLabel}${completedToday ? `, ${availabilityLabel}` : ''}`}
      className="relative w-full overflow-hidden rounded-[16px] bg-[#56504B]"
      style={{ aspectRatio: 1.73 }}>
      {challenge.coverImageUrl ? (
        <Image
          source={{ uri: challenge.coverImageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.65)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View className="flex-1 justify-between p-4">
        <View className="flex-row items-start justify-between gap-x-2">
          <Text className="min-w-0 flex-1 pt-1 font-heading text-sm font-semibold text-white">
            {statusLabel}
          </Text>
          <View className="rounded-full bg-black/50 px-3 py-1.5">
            <Text className="font-heading text-sm font-semibold text-white">
              {challenge.totalAvailablePoints} {pointsLabel(challenge.totalAvailablePoints)}
            </Text>
          </View>
        </View>
        <View>
          <Text numberOfLines={2} className="font-heading text-xl font-semibold text-white">
            {challenge.name}
          </Text>
          <Text className="mt-1 font-body text-sm text-white/90">
            {challenge.participantCount}{' '}
            {challenge.participantCount === 1 ? 'sweat sister' : 'sweat sisters'} joined
          </Text>
        </View>
      </View>
      {completedToday ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          className="items-center justify-center px-4">
          <Text className="text-center font-body text-sm text-white">{availabilityLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
