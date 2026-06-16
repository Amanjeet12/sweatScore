import { View } from 'react-native';

import PodiumSlot from './PodiumSlot';

export type PodiumEntry = {
  userId: string;
  name: string;
  image: string | null;
  displayTotalPoints: number;
} | null;

export type PodiumProps = {
  podium: [PodiumEntry, PodiumEntry, PodiumEntry];
  onPressEntry?: (userId: string) => void;
};

export default function Podium({ podium, onPressEntry }: PodiumProps) {
  const [first, second, third] = podium;
  return (
    <View className="flex-row items-end justify-center gap-x-4 px-4 pb-6">
      <PodiumSlot rank={2} entry={second} onPress={onPressEntry} />
      <PodiumSlot rank={1} isHero entry={first} onPress={onPressEntry} />
      <PodiumSlot rank={3} entry={third} onPress={onPressEntry} />
    </View>
  );
}
