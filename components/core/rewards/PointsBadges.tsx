import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '~/utils/cn';

const goldBadge = require('~/assets/rewards/gold.png');
const grayBadge = require('~/assets/rewards/gray.png');

interface PointsBadgesProps {
  totalPoints: number;
}

export const PointsBadges: React.FC<PointsBadgesProps> = ({ totalPoints }) => {
  const badges = [
    { points: 100, label: '100 points' },
    { points: 250, label: '250 points' },
    { points: 500, label: '500 points' },
  ];

  return (
    <View className="px-5 py-4">
      <View className="flex-row items-center justify-between">
        {badges.map((badge, index) => (
          <React.Fragment key={badge.points}>
            <View className="flex-1 items-center">
              <Image
                source={totalPoints >= badge.points ? goldBadge : grayBadge}
                contentFit="contain"
                style={{
                  width: 65,
                  height: 65,
                  marginTop: 10,
                  opacity: totalPoints >= badge.points ? 1 : 0.5,
                }}
              />
              <Text
                className={cn('mt-2 text-center text-base text-gray-500', {
                  'font-bold text-primary-500': totalPoints >= badge.points,
                })}>
                {badge.label}
              </Text>
            </View>
            {index < badges.length - 1 && <View className="mb-6 h-1 flex-[0.5] bg-gray-200" />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};
