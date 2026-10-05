import { Pressable, View } from 'react-native';

import LeaderboardPeriodDropdown, { LeaderboardPeriod } from './LeaderboardPeriodDropdown';

import {
  leagueStyles as styles,
  leagueTypography as type,
} from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';

type Props = {
  title: string;
  mode: 'points' | 'streak';
  timeLeft: string;
  now: Date;
  period: LeaderboardPeriod;
  onChangePeriod: (period: LeaderboardPeriod) => void;
  onChangeMode: (mode: 'points' | 'streak') => void;
};
export default function LeaderboardHeader({
  title,
  mode,
  timeLeft,
  now,
  period,
  onChangePeriod,
  onChangeMode,
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.period}>
        <Text style={type.caption}>
          {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now)}
        </Text>
        <Text style={type.caption}>{mode === 'points' ? timeLeft : 'Current streak'}</Text>
      </View>
      <View style={[styles.period, { marginTop: 4 }]}>
        <Text style={[type.title, { flexShrink: 1 }]}>{title}</Text>
        <LeaderboardPeriodDropdown value={period} onChange={onChangePeriod} />
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
