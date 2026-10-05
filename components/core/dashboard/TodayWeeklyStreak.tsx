import { useQuery } from 'convex/react';
import { Fire } from 'phosphor-react-native';
import type { RefObject } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function TodayWeeklyStreak({
  daysEarned = 0,
  target = 5,
  currentWeeklyStreak = 0,
  tourTargetRef,
  refresh,
}: {
  daysEarned?: number;
  target?: number;
  currentWeeklyStreak?: number;
  tourTargetRef?: RefObject<View>;
  refresh?: number;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const circleSize = Math.min(40, Math.max(28, (width - insets.left - insets.right - 44) / 8));
  const week = useQuery(api.challengeCompletions.getUserCompletionsForWeek, { refresh });

  return (
    <View ref={tourTargetRef} collapsable={false} className="mx-[22px] mb-10">
      <View className="flex-row items-center justify-between">
        <Text style={[type.sectionHeading, { flex: 1, paddingRight: 12 }]}>Your streak</Text>
        <Text style={[type.caption, { flexShrink: 1, textAlign: 'right' }]}>
          {Math.min(daysEarned, target)} of {target} days
        </Text>
      </View>
      {currentWeeklyStreak > 0 ? (
        <Text style={[type.smallCaption, { color: '#807A76' }]} className="mt-2">
          {currentWeeklyStreak} week streak
        </Text>
      ) : null}
      <View className="mt-4 flex-row justify-between">
        {(
          week?.days ??
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel) => ({
            dayLabel,
            earned: false,
            isToday: false,
          }))
        ).map((day) => (
          <View key={day.dayLabel} className="items-center">
            <Text style={type[day.isToday ? 'currentWeekday' : 'weekday']} className="mb-2">
              {day.dayLabel.charAt(0)}
            </Text>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: circleSize,
                height: circleSize,
                backgroundColor: day.earned ? '#FFE3D3' : '#F8F8F8',
                borderWidth: day.isToday ? 2 : 0,
                borderColor: '#ff5a1f',
              }}>
              {day.earned ? <Fire size={20} color="#ff5a1f" weight="fill" /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
