import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
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
  const statusLabel =
    challenge.status === 'upcoming'
      ? `Starts in ${challenge.daysUntilStart} ${challenge.daysUntilStart === 1 ? 'day' : 'days'}`
      : challenge.status === 'ended'
        ? challenge.isJoined
          ? `${challenge.completedDays} of ${challenge.durationDays} completed`
          : 'Challenge ended'
        : `Day ${Math.max(1, challenge.currentDay)}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={completedToday}
      accessibilityRole="button"
      accessibilityState={{ disabled: completedToday }}
      accessibilityLabel={`${challenge.name}, ${statusLabel}${completedToday ? `, ${availabilityLabel}` : ''}`}
      className="relative w-full overflow-hidden rounded-[16px] bg-[#56504B]"
      style={{ minHeight: 200 }}>
      {challenge.coverImageUrl ? (
        <Image
          source={{ uri: challenge.coverImageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          contentPosition={{ top: '40%', left: '50%' }}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.32)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '35%' }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' }}
      />
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 48, padding: 16 }}>
        <View
          style={{
            alignSelf: 'flex-end',
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: 12,
            paddingVertical: 5,
            marginTop: -4,
            marginRight: -4,
          }}>
          <Text style={[type.caption, { fontFamily: 'Inter_600SemiBold', color: '#fff' }]}>
            {challenge.totalAvailablePoints} {pointsLabel(challenge.totalAvailablePoints)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: '50%' }}>
            <Text style={[type.sectionHeading, { color: '#fff' }]}>{challenge.name}</Text>
            <Text style={[type.caption, { marginTop: 4, color: 'rgba(255,255,255,0.92)' }]}>
              {challenge.participantCount}{' '}
              {challenge.participantCount === 1 ? 'sweat sister' : 'sweat sisters'} joined
            </Text>
          </View>
          <Text
            style={[
              type.caption,
              {
                fontFamily: 'Inter_500Medium',
                color: '#fff',
                flexShrink: 1,
                marginLeft: 'auto',
                textAlign: 'right',
              },
            ]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      {completedToday ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          className="items-center justify-center px-4">
          <Text style={[type.supporting, { color: '#fff', textAlign: 'center' }]}>
            {availabilityLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
