import { Image } from 'expo-image';
import { CaretRight, CheckCircle } from 'phosphor-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

import ParticipantAvatars from '~/components/core/challenges/ParticipantAvatars';
import { Text } from '~/components/ui/text';

export default function CommunityChallengeCard({
  challenge,
  onPress,
  onJoin,
  joining,
}: {
  challenge: any;
  onPress: () => void;
  onJoin: () => void;
  joining: boolean;
}) {
  const completedToday = challenge.isJoined && challenge.completedToday;
  const progress = Math.min(
    100,
    challenge.durationDays > 0 ? (challenge.completedDays / challenge.durationDays) * 100 : 0
  );
  const statusLabel =
    challenge.status === 'upcoming'
      ? challenge.daysUntilStart === 1
        ? 'Starts tomorrow'
        : `Starts in ${challenge.daysUntilStart} days`
      : `Day ${Math.max(1, challenge.currentDay)}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={completedToday}
      accessibilityRole="button"
      accessibilityState={{ disabled: completedToday }}
      accessibilityLabel={`${challenge.name}${completedToday ? ', completed today' : ''}`}
      className={`overflow-hidden rounded-[24px] ${completedToday ? 'bg-[#F1EFED]' : 'bg-white'}`}
      style={{ opacity: completedToday ? 0.62 : 1 }}>
      <View className="relative h-[158px] overflow-hidden bg-[#E9DDD5]">
        {challenge.coverImageUrl ? (
          <Image
            source={{ uri: challenge.coverImageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : null}

        <View className="absolute left-3 top-3 rounded-[20px] bg-black/65 px-3 py-1.5">
          <Text
            style={{ fontFamily: 'Inter_600SemiBold' }}
            className="text-[10px] uppercase tracking-[0.8px] text-white">
            {challenge.tag}
          </Text>
        </View>
      </View>

      <View className="px-4 pb-4 pt-3.5">
        <View className="flex-row items-start justify-between gap-x-3">
          <Text
            style={{ fontFamily: 'Inter_700Bold' }}
            className="min-w-0 flex-1 text-lg text-[#1A1A1A]">
            {challenge.name}
          </Text>
          <Text
            style={{ fontFamily: 'Inter_600SemiBold' }}
            className={`pt-1 text-[10px] ${completedToday ? 'text-[#6F6A66]' : 'text-[#FF5C35]'}`}>
            {statusLabel}
          </Text>
        </View>

        <Text className="mt-1 font-body text-xs leading-[18px] text-[#77716D]" numberOfLines={2}>
          {challenge.description}
        </Text>

        {challenge.isJoined ? (
          <>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="font-body text-[10px] text-[#77716D]">
                {challenge.completedDays} {challenge.completedDays === 1 ? 'day' : 'days'} complete
              </Text>
              <Text
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="text-[10px] text-[#FF5C35]">
                {Math.round(progress)}%
              </Text>
            </View>
            <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEEAE7]">
              <View
                className={`h-full rounded-full ${completedToday ? 'bg-[#9A9490]' : 'bg-[#FF5C35]'}`}
                style={{ width: `${progress}%` }}
              />
            </View>
          </>
        ) : null}

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-x-2.5">
            <ParticipantAvatars
              avatars={challenge.participantAvatars}
              count={challenge.participantCount}
              size={30}
            />
            {challenge.participantCount > 0 ? (
              <Text
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="text-[10px] text-[#313131]">
                {challenge.participantCount}{' '}
                {challenge.participantCount === 1 ? 'member joined' : 'members joined'}
              </Text>
            ) : null}
          </View>

          {challenge.isJoined ? (
            completedToday ? (
              <View className="flex-row items-center gap-x-1.5">
                <CheckCircle size={18} color="#6F6A66" weight="fill" />
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="text-[10px] text-[#6F6A66]">
                  Done today
                </Text>
              </View>
            ) : (
              <CaretRight size={18} color="#FF5C35" weight="bold" />
            )
          ) : (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onJoin();
              }}
              disabled={joining}
              className="min-w-[74px] items-center rounded-[20px] bg-[#FF5C35] px-4 py-2">
              {joining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-white">
                  Join
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
