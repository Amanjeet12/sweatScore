import { View } from 'react-native';

import LeaderboardPeriodDropdown, { LeaderboardPeriod } from './LeaderboardPeriodDropdown';

import { Text } from '~/components/ui/text';

type LeaderboardHeaderProps = {
  period: LeaderboardPeriod;
  timeLeft: string;
  canChangePeriod: boolean;
  onChangePeriod: (period: LeaderboardPeriod) => void;
};

export default function LeaderboardHeader({
  period,
  timeLeft,
  canChangePeriod,
  onChangePeriod,
}: LeaderboardHeaderProps) {
  return (
    <View className="flex-row items-start justify-between gap-x-3 px-4 pb-5 pt-5">
      <View className="flex-1">
        <Text className="font-heading text-2xl font-extrabold text-[#1A1A1A]">League</Text>
        <Text className="mt-0.5 font-body text-sm text-[#5A5A5A]">{timeLeft}</Text>
      </View>

      {canChangePeriod ? (
        <LeaderboardPeriodDropdown value={period} onChange={onChangePeriod} />
      ) : null}
    </View>
  );
}
