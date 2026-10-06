import { CaretDown, Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { leagueTypography as type } from '~/components/core/design/LeagueStyles';
import { Text } from '~/components/ui/text';
import { LeaderboardPeriod } from '~/shared/leaguePeriod';
export type { LeaderboardPeriod } from '~/shared/leaguePeriod';

const OPTIONS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'today', label: 'Today' },
];

const LABELS: Record<LeaderboardPeriod, string> = {
  month: 'This Month',
  week: 'This Week',
  today: 'Today',
};

type LeaderboardPeriodDropdownProps = {
  value: LeaderboardPeriod;
  onChange: (period: LeaderboardPeriod) => void;
  timeLeft: string;
};

export default function LeaderboardPeriodDropdown({
  value,
  onChange,
  timeLeft,
}: LeaderboardPeriodDropdownProps) {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  const selectPeriod = (period: LeaderboardPeriod) => {
    setIsOpen(false);
    onChange(period);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Leaderboard period: ${LABELS[value]}, ${timeLeft}`}
        accessibilityHint="Opens the leaderboard period options"
        onPress={() => setIsOpen(true)}
        hitSlop={6}
        className="min-h-11 flex-row items-center justify-center gap-x-2 py-2">
        <CaretDown size={15} color="#6f6f6f" weight="bold" />
        <Text style={type.caption}>{timeLeft}</Text>
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}>
        <Pressable
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          className="flex-1"
          onPress={() => setIsOpen(false)}>
          <View
            className="absolute left-[22px] right-[22px] overflow-hidden rounded-[20px] bg-white p-2"
            style={{
              top: insets.top + 68,
              maxHeight: '75%',
            }}>
            <ScrollView>
              {OPTIONS.map((option) => {
                const selected = value === option.id;

                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectPeriod(option.id)}
                    className={
                      selected
                        ? 'rounded-[16px] bg-[#fff3ea] px-4 py-3.5'
                        : 'rounded-lg px-4 py-3.5 active:bg-[#FFF0E8]'
                    }>
                    <View className="flex-row items-center justify-between gap-x-3">
                      <Text style={[type.name, { flexShrink: 1 }]}>{option.label}</Text>
                      {selected ? <Check size={16} color="#ff5a1f" weight="bold" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
