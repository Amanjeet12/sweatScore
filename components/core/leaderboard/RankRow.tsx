import { Fire } from 'phosphor-react-native';
import { TouchableOpacity, View, useWindowDimensions } from 'react-native';

import LeagueAvatar from './LeagueAvatar';

import {
  leagueStyles as styles,
  leagueTypography as type,
} from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type RankRowProps = {
  rank?: number;
  name: string;
  avatarUri: string | null;
  displayTotalPoints: number;
  targetPoints: number;
  mode?: 'points' | 'streak';
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
};

export default function RankRow({
  rank,
  name,
  avatarUri,
  displayTotalPoints,
  targetPoints,
  mode = 'points',
  onPress,
  isFirst = false,
}: RankRowProps) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 350 || fontScale > 1.3;
  const safeTarget = Math.max(1, targetPoints);
  const pctLabel = Math.min(1, displayTotalPoints / safeTarget) * 100;
  const Wrapper = onPress ? TouchableOpacity : View;
  const metric =
    mode === 'streak' ? (
      <View style={styles.metric}>
        <Fire size={20} weight="fill" color={displayTotalPoints > 0 ? '#ff5a1f' : '#c9c9c9'} />
        <Text style={type.score}>{displayTotalPoints}</Text>
        <Text style={type.caption}>{displayTotalPoints === 1 ? 'week' : 'weeks'}</Text>
      </View>
    ) : (
      <Text style={type.score}>{displayTotalPoints}</Text>
    );
  return (
    <Wrapper
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Rank ${rank ?? 'unranked'}, ${name}, ${displayTotalPoints} ${mode === 'streak' ? 'weeks' : 'points'}`}
      style={[styles.row, isFirst && { marginTop: 10 }]}>
      <Text style={[type.rank, styles.rank]}>{rank ?? '—'}</Text>
      <LeagueAvatar name={name} uri={avatarUri} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.name}>{formatName(name)}</Text>
        {compact ? <View style={{ marginTop: 4 }}>{metric}</View> : null}
        {mode === 'points' ? (
          <View style={styles.progress}>
            <View
              style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: '#ff5a1f',
                width: `${pctLabel}%`,
                minWidth: displayTotalPoints > 0 ? 2 : 0,
              }}
            />
          </View>
        ) : null}
      </View>
      {!compact ? metric : null}
    </Wrapper>
  );
}
