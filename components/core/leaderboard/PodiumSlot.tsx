import { Fire } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import LeagueAvatar from './LeagueAvatar';

import { leagueTypography as type } from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type PodiumSlotProps = {
  mode?: 'points' | 'streak';
  rank: 1 | 2 | 3;
  isHero?: boolean;
  entry: {
    userId: string;
    name: string;
    image: string | null;
    displayTotalPoints: number;
  } | null;
  onPress?: (userId: string) => void;
};

const RANK_COLORS = { 1: '#e3b24f', 2: '#a8a8a8', 3: '#b87333' } as const;
const AVATAR_COLORS = { 1: '#d4774a', 2: '#b5502f', 3: '#d4774a' } as const;
export default function PodiumSlot({
  rank,
  isHero,
  entry,
  onPress,
  mode = 'points',
}: PodiumSlotProps) {
  const [slotWidth, setSlotWidth] = useState(110);
  const avatarSize = Math.min(isHero ? 88 : 68, Math.max(44, slotWidth - 14));
  const Wrapper = entry && onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={entry && onPress ? () => onPress(entry.userId) : undefined}
      onLayout={(event) => setSlotWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole={entry && onPress ? 'button' : undefined}
      accessibilityLabel={
        entry
          ? `Rank ${rank}, ${entry.name}, ${entry.displayTotalPoints} ${mode === 'streak' ? 'weeks' : 'points'}`
          : `Rank ${rank}: empty`
      }
      style={{ flex: 1, minWidth: 0, paddingTop: isHero ? 0 : 22, alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: RANK_COLORS[rank],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text maxFontSizeMultiplier={1.3} style={type.badge}>
          {rank}
        </Text>
      </View>
      <View
        style={{
          shadowColor: isHero ? '#ff5a1f' : '#1e140a',
          shadowOffset: { width: 0, height: isHero ? 8 : 6 },
          shadowOpacity: isHero ? 0.28 : 0.16,
          shadowRadius: isHero ? 20 : 16,
          elevation: 3,
          borderRadius: avatarSize,
        }}>
        {entry ? (
          <LeagueAvatar
            name={entry.name}
            uri={entry.image}
            size={avatarSize}
            ring={isHero}
            color={AVATAR_COLORS[rank]}
          />
        ) : (
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#d8d2cd',
              backgroundColor: '#f4f1ee',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={type.caption}>—</Text>
          </View>
        )}
        {mode === 'streak' && entry ? (
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: '#fff',
              backgroundColor: entry.displayTotalPoints > 0 ? '#ff5a1f' : '#c9c9c9',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Fire size={14} color="#fff" weight="fill" />
          </View>
        ) : null}
      </View>
      {entry ? (
        <View style={{ width: '100%', paddingHorizontal: 2, gap: 2 }}>
          <Text style={[type.name, { textAlign: 'center' }]}>{formatName(entry.name)}</Text>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {entry.displayTotalPoints.toLocaleString()}{' '}
            {mode === 'streak'
              ? entry.displayTotalPoints === 1
                ? 'week'
                : 'weeks'
              : entry.displayTotalPoints === 1
                ? 'pt'
                : 'pts'}
          </Text>
        </View>
      ) : (
        <View style={{ minHeight: 30 }} />
      )}
    </Wrapper>
  );
}
