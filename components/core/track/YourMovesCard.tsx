import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';

import MoveRow from './MoveRow';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function YourMovesCard() {
  const data = useQuery(api.track.yourMoves.getYourMoves);
  const { isPro } = useRevenueCat();

  if (data === undefined) return null;

  const todayEmpty = data.today.length === 0;
  const weekEmpty = data.earlierThisWeek.length === 0;
  const monthEmpty = data.earlierThisMonth.length === 0;

  const cardEmpty = todayEmpty && weekEmpty && (isPro ? monthEmpty : true);

  return (
    <View className="mx-screen-x rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Your Challenges</Text>
      <Text className=" font-body text-sm text-[#838383] pt-1">
        Your videos will be saved for 30 days
      </Text>
      {cardEmpty ? (
        <View className="items-center py-6">
          <Text className="text-center font-body text-sm text-[#838383]">
            No completions yet. Record a move to fill this section.
          </Text>
        </View>
      ) : (
        <>
          {/* Today */}
          {!todayEmpty && (
            <>
              <Text className="mt-4 font-body text-base text-[#5A5A5A]">Today</Text>
              {data.today.map((row) => (
                <MoveRow
                  key={row._id}
                  challengeName={row.challengeName}
                  coverImageUrl={row.coverImageUrl}
                  pointsEarned={row.pointsEarned}
                  createdAt={row.createdAt}
                  compositeVideoUrl={row.compositeVideoUrl}
                  timesCompleted={row.timesCompleted}
                />
              ))}
            </>
          )}

          {/* Earlier this week */}
          {!weekEmpty && (
            <>
              <Text className="mt-4 font-body text-base text-[#5A5A5A]">Earlier this week</Text>
              {data.earlierThisWeek.map((row) => (
                <MoveRow
                  key={row._id}
                  challengeName={row.challengeName}
                  coverImageUrl={row.coverImageUrl}
                  pointsEarned={row.pointsEarned}
                  createdAt={row.createdAt}
                  compositeVideoUrl={row.compositeVideoUrl}
                  timesCompleted={row.timesCompleted}
                />
              ))}
            </>
          )}

          {/* Earlier this month */}
          {isPro ? (
            !monthEmpty && (
              <>
                <Text className="mt-4 font-body text-base text-[#5A5A5A]">Earlier this month</Text>
                {data.earlierThisMonth.map((row) => (
                  <MoveRow
                    key={row._id}
                    challengeName={row.challengeName}
                    coverImageUrl={row.coverImageUrl}
                    pointsEarned={row.pointsEarned}
                    createdAt={row.createdAt}
                    compositeVideoUrl={row.compositeVideoUrl}
                    timesCompleted={row.timesCompleted}
                  />
                ))}
              </>
            )
          ) : (
            <View>
              <Text className="mt-4 font-body text-base text-[#5A5A5A]">Earlier this month</Text>
              <View className="items-center py-4">
                <View className="items-center justify-center rounded-full bg-[#1A1A1A] px-4 py-1.5">
                  <Text className="font-body text-sm font-semibold text-white">Pro</Text>
                </View>
                <Text className="mt-3 text-center font-heading text-lg font-bold text-[#1A1A1A]">
                  You&apos;ve moved. Now own it.
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/rewards/paywall',
                      params: { redirectTo: '/(tabs)/rewards' },
                    })
                  }
                  className="mt-3 flex-row items-center gap-x-1">
                  <Text className="font-body text-base font-semibold text-[#F76B1C]">
                    See all your moves this month →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}
