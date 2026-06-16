import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';

import Confetti from './Confetti';

import { Text } from '~/components/ui/text';

interface MissionCardData {
  title: string;
  description: string;
  progress: number | null;
  progressCount: string | null;
  progressType: string | null;
  onInfoPress: () => void;
}

interface SwipeableMissionCardProps {
  todayCard: MissionCardData;
}

export default function SwipeableMissionCard({ todayCard }: SwipeableMissionCardProps) {
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const hasTriggeredConfetti = useRef(false);

  // Trigger confetti when today's mission is completed
  useEffect(() => {
    if (todayCard.progress !== null && todayCard.progress >= 100 && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      setConfettiTrigger((prev) => prev + 1);
    }
    // Reset when progress drops below 100 (new day/mission)
    if (todayCard.progress !== null && todayCard.progress < 100) {
      hasTriggeredConfetti.current = false;
    }
  }, [todayCard.progress]);

  const renderCard = (cardData: MissionCardData) => (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/share`)}
      activeOpacity={0.9}
      style={{
        borderRadius: 24,
        ...(Platform.OS === 'ios'
          ? {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            }
          : {
              elevation: 3,
            }),
      }}>
      <LinearGradient
        colors={['#DC6743', '#EE875E', '#FCB38A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          paddingHorizontal: 24,
          paddingVertical: 24,
          minHeight: 158,
          position: 'relative',
        }}>
        <Confetti trigger={confettiTrigger} />
        <View className="flex-row items-center justify-between gap-x-4">
          <View className="flex-1 justify-center">
            <Text className="text-lg text-white">{cardData.description}</Text>
          </View>

          {cardData.progress !== null ? (
            <View className="flex-shrink-0">
              <AnimatedCircularProgress
                size={110}
                width={15}
                fill={cardData.progress >= 100 ? 100 : cardData.progress}
                tintColor="#FEF2EB"
                backgroundColor="#FCBB94">
                {() => (
                  <>
                    <Text className="text-xl font-bold leading-tight text-white">
                      {cardData.progressCount}
                    </Text>
                    <Text className="text-sm leading-tight text-white">
                      /{cardData.progressType}
                    </Text>
                  </>
                )}
              </AnimatedCircularProgress>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View>
      {/* Header */}
      <View className="mb-2">
        <Text className="text-xl font-semibold text-black/60">Today's challenge</Text>
      </View>

      {/* Card */}
      <View style={{ marginTop: 8 }}>{renderCard(todayCard)}</View>
    </View>
  );
}
