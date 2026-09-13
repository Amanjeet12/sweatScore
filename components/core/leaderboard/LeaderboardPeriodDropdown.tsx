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
        hitSlop={6}
        className="min-h-11 min-w-[132px] flex-row items-center justify-center gap-x-2 rounded-lg bg-[#F1ECE7] px-4 py-2.5 active:opacity-90">
        <Text className="font-heading text-xs font-semibold text-[#313131]">{LABELS[value]}</Text>
        <CaretDown size={15} color="#77716D" weight="bold" />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}>
        <Pressable className="flex-1" onPress={() => setIsOpen(false)}>
          <View
            className="absolute right-4 w-[180px] overflow-hidden rounded-xl bg-white p-1.5"
            style={{
              top: insets.top + 68,
            }}>
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
                      ? 'rounded-lg bg-[#FF5C35] px-4 py-3.5'
                      : 'rounded-lg px-4 py-3.5 active:bg-[#FFF0E8]'
                  }>
                  <View className="flex-row items-center justify-between gap-x-3">
                    <Text
                      className={
                        selected
                          ? 'font-heading text-sm font-semibold text-white'
                          : 'font-body text-sm font-medium text-[#1A1A1A]'
                      }>
                      {option.label}
                    </Text>
                    {selected ? <Check size={16} color="#FFFFFF" weight="bold" /> : null}
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
