import { Pressable, View } from 'react-native';

import LeaderboardPeriodDropdown from './LeaderboardPeriodDropdown';

import {
  leagueStyles as styles,
  leagueTypography as type,
} from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';
import type { LeaderboardPeriod } from '~/shared/leaguePeriod';

type Props = {
  title: string;
  mode: 'points' | 'streak';
  now: Date;
  period: LeaderboardPeriod;
  timeLeft: string;
  onChangePeriod: (period: LeaderboardPeriod) => void;
  onChangeMode: (mode: 'points' | 'streak') => void;
};
export default function LeaderboardHeader({
  title,
  mode,
  now,
  onChangeMode,
  period,
  timeLeft,
  onChangePeriod,
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.period}>
        <Text style={type.caption}>
          {period === 'month'
            ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now)
            : period === 'week'
              ? 'This Week'
              : 'Today'}
        </Text>
        <LeaderboardPeriodDropdown value={period} onChange={onChangePeriod} timeLeft={timeLeft} />
      </View>
      <View style={[styles.period, { marginTop: 4 }]}>
        <Text style={[type.title, { flexShrink: 1 }]}>{title}</Text>
      </View>
      <View style={styles.tabs}>
        {(['points', 'streak'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onChangeMode(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            style={[styles.tab, { borderBottomColor: mode === value ? '#ff5a1f' : 'transparent' }]}>
            <Text style={mode === value ? type.selectedTab : type.tab}>
              {value === 'points' ? 'Points' : 'Streak'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
