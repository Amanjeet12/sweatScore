import { View } from 'react-native';

import PodiumSlot from './PodiumSlot';

import { leagueStyles } from '~/components/core/design/LeagueStyles';

export type PodiumEntry = {
  userId: string;
  name: string;
  image: string | null;
  displayTotalPoints: number;
} | null;

export type PodiumProps = {
  mode?: 'points' | 'streak';
  podium: [PodiumEntry, PodiumEntry, PodiumEntry];
  onPressEntry?: (userId: string) => void;
};

export default function Podium({ podium, onPressEntry, mode = 'points' }: PodiumProps) {
  const [first, second, third] = podium;
  return (
    <View style={leagueStyles.podium}>
      <PodiumSlot mode={mode} rank={2} entry={second} onPress={onPressEntry} />
      <PodiumSlot mode={mode} rank={1} isHero entry={first} onPress={onPressEntry} />
      <PodiumSlot mode={mode} rank={3} entry={third} onPress={onPressEntry} />
    </View>
  );
}
