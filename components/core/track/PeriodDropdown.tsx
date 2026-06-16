import { CaretDown } from 'phosphor-react-native';
import { View } from 'react-native';
import { Menu, MenuOption, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import { Text } from '~/components/ui/text';

export type Period = 'week' | 'month' | 'year';

const OPTIONS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const LABEL: Record<Period, string> = { week: 'Week', month: 'Month', year: 'Year' };

export type PeriodDropdownProps = {
  value: Period;
  onChange: (p: Period) => void;
};

export default function PeriodDropdown({ value, onChange }: PeriodDropdownProps) {
  return (
    <Menu>
      <MenuTrigger
        customStyles={{
          triggerWrapper: {
            backgroundColor: '#F76B1C',
            borderRadius: 9999,
            paddingHorizontal: 16,
            paddingVertical: 6,
          },
        }}>
        <View className="flex-row items-center gap-x-1">
          <Text className="font-heading text-sm font-bold text-white">{LABEL[value]}</Text>
          <CaretDown size={12} color="#FFFFFF" weight="bold" />
        </View>
      </MenuTrigger>
      <MenuOptions
        customStyles={{
          optionsContainer: {
            borderRadius: 12,
            paddingVertical: 4,
            marginTop: 8,
            minWidth: 140,
          },
        }}>
        {OPTIONS.map((o) => {
          const selected = value === o.id;
          return (
            <MenuOption key={o.id} onSelect={() => onChange(o.id)}>
              <View className="px-3 py-2">
                <Text
                  className={
                    selected
                      ? 'font-heading text-base font-bold text-primary-500'
                      : 'font-body text-base text-[#1A1A1A]'
                  }>
                  {o.label}
                </Text>
              </View>
            </MenuOption>
          );
        })}
      </MenuOptions>
    </Menu>
  );
}
