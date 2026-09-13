import { CaretDown, Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';

type Range = 'week' | 'month' | 'year';
const label = (value: Range) => value.charAt(0).toUpperCase() + value.slice(1);

export default function TrendRangeDropdown({
  value,
  onChange,
}: {
  value: Range;
  onChange: (value: Range) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ zIndex: open ? 100 : 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Activity trend: ${label(value)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        className="min-h-11 flex-row items-center gap-x-2 px-2">
        <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#FF5C35]">
          {label(value)}
        </Text>
        <CaretDown size={14} color="#FF5C35" weight="bold" />
      </Pressable>

      {open ? (
        <View
          className="absolute right-0 top-12 w-40 rounded-[20px] border border-[#EEE8E3] bg-white p-2"
          style={{
            zIndex: 101,
            elevation: 12,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
          }}>
          {(['week', 'month', 'year'] as const).map((option) => {
            const selected = value === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`h-12 flex-row items-center justify-between rounded-xl px-3 ${selected ? 'bg-[#FFF0E8]' : ''}`}>
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className={`text-sm ${selected ? 'text-[#FF5C35]' : 'text-[#1D1B1A]'}`}>
                  {label(option)}
                </Text>
                {selected ? <Check size={16} color="#FF5C35" weight="bold" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
