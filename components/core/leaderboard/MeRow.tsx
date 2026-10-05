import { Fire } from 'phosphor-react-native';
import { TouchableOpacity, View, useWindowDimensions } from 'react-native';

import LeagueAvatar from './LeagueAvatar';

import {
  leagueStyles as styles,
  leagueTypography as type,
} from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';

type MeRowProps = {
  rank?: number;
  avatarUri?: string;
  displayTotalPoints: number;
  targetPoints: number;
  mode?: 'points' | 'streak';
  userName: string;
  onPress?: () => void;
};

export default function MeRow({
  rank,
  avatarUri,
  displayTotalPoints,
  targetPoints,
  mode = 'points',
  userName,
  onPress,
}: MeRowProps) {
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
      <Text style={type.myScore}>{displayTotalPoints}</Text>
    );
  return (
    <Wrapper
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Your position, rank ${rank ?? 'unranked'}, ${displayTotalPoints} ${mode === 'streak' ? 'weeks' : 'points'}`}
      style={styles.me}>
      <Text style={[type.myRank, styles.rank]}>{rank ?? '—'}</Text>
      <LeagueAvatar name={userName} uri={avatarUri} ring />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.name}>You</Text>
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
