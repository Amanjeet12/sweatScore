import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { daysRemainingInMonth } from '~/utils/daysRemainingInMonth';
import { formatPoints } from '~/utils/formatter';

interface MonthlyProgressCardProps {
  coverImageUrl: string;
  title: string;
  targetPoints: number;
  earnedPoints: number;
}

export default function MonthlyProgressCard({
  coverImageUrl,
  title,
  targetPoints,
  earnedPoints,
}: MonthlyProgressCardProps) {
  const exceeded = earnedPoints >= targetPoints;
  const progressPercent = Math.min(100, (earnedPoints / targetPoints) * 100);

  const daysLeft = daysRemainingInMonth();

  return (
    <View className="px-screen">
      <View className="overflow-hidden rounded-card">
        {/* Cover Image */}
        <Image
          source={{ uri: coverImageUrl }}
          style={{
            width: '100%',
            height: undefined,
            aspectRatio: 960 / 516,
          }}
          contentFit="cover"
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '70%',
          }}
        />

        {/* Badge — top left */}
        <View className="absolute left-8 top-6 flex-row items-center gap-x-2">
          <Image
            source={require('~/assets/icons/Days left.png')}
            style={{ width: 20, height: 20 }}
            contentFit="contain"
          />
          <Text className="font-body text-sm font-bold text-white">
            {exceeded ? 'You did that!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
          </Text>
        </View>

        {/* Bottom content overlay */}
        <View className="absolute bottom-0 left-0 right-0 px-8 pb-8">
          {/* Title + Points row */}
          <View className="mb-3 flex-row items-end justify-between">
            <Text
              className="font-heading text-xl font-bold text-white"
              style={{ flex: 1, marginRight: 12 }}>
              {title}
            </Text>
            <View className="flex-row items-baseline">
              <Text className="font-heading font-bold text-white" style={{ fontSize: 18 }}>
                {formatPoints(earnedPoints)}
              </Text>
              <Text className="font-body text-white" style={{ fontSize: 18 }}>
                {' '}
                /{formatPoints(targetPoints)} pts
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="h-progress w-full overflow-hidden rounded-full bg-[#EEEAE5]">
            <View
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
