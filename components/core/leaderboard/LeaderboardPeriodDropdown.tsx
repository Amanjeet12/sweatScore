import { CaretDown, Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';

export type LeaderboardPeriod = 'month' | 'week' | 'today';

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
};

export default function LeaderboardPeriodDropdown({
  value,
  onChange,
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
        accessibilityLabel={`Leaderboard period: ${LABELS[value]}`}
        accessibilityHint="Opens the leaderboard period options"
        onPress={() => setIsOpen(true)}
        className="flex-row items-center gap-x-1.5 rounded-full border border-[#E8DED6] bg-white px-3.5 py-2">
        <Text className="font-heading text-xs font-bold text-[#1A1A1A]">{LABELS[value]}</Text>
        <CaretDown size={12} color="#F76B1C" weight="bold" />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}>
        <Pressable className="flex-1" onPress={() => setIsOpen(false)}>
          <View
            className="absolute right-4 w-[160px] overflow-hidden rounded-2xl border border-[#E8DED6] bg-white py-1.5"
            style={{
              top: insets.top + 68,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 7,
            }}>
            {OPTIONS.map((option) => {
              const selected = value === option.id;

              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectPeriod(option.id)}
                  className={selected ? 'mx-1 rounded-xl bg-[#FFF0E8] px-3 py-3' : 'px-4 py-3'}>
                  <View className="flex-row items-center justify-between gap-x-3">
                    <Text
                      className={
                        selected
                          ? 'font-heading text-sm font-bold text-[#F76B1C]'
                          : 'font-body text-sm font-medium text-[#1A1A1A]'
                      }>
                      {option.label}
                    </Text>
                    {selected ? <Check size={15} color="#F76B1C" weight="bold" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
