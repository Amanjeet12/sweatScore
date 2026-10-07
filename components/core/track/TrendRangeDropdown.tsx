import { CaretDown, Check } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import {
  prototypeColors as colors,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

type Range = 'week' | 'month' | 'year';
const label = (value: Range) => value.charAt(0).toUpperCase() + value.slice(1);

export function ProgressDropdown<T extends string | number>({
  value,
  onChange,
  options,
  accessibilityLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  accessibilityLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${options.find(([id]) => id === value)?.[1] ?? ''}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 4,
          borderRadius: 16,
          backgroundColor: 'transparent',
        }}>
        <Text
          style={[type.compactAction, { fontFamily: 'Inter_400Regular', fontWeight: 'normal' }]}>
          {options.find(([id]) => id === value)?.[1]}
        </Text>
        <CaretDown size={18} color={colors.ink} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close activity trend options"
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 22,
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}>
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              maxHeight: '75%',
              alignSelf: 'center',
              borderRadius: 20,
              backgroundColor: '#fff',
              padding: 8,
            }}>
            <ScrollView>
              {options.map(([option, title]) => {
                const selected = value === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    onPress={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    style={{
                      minHeight: 52,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 16,
                      backgroundColor: selected ? '#f5f5f5' : '#fff',
                    }}>
                    <Text style={selected ? type.selectedOption : type.option}>{title}</Text>
                    {selected ? <Check size={20} color={colors.accent} weight="bold" /> : null}
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

export default function TrendRangeDropdown({
  value,
  onChange,
}: {
  value: Range;
  onChange: (value: Range) => void;
}) {
  return (
    <ProgressDropdown
      value={value}
      onChange={onChange}
      accessibilityLabel="Activity trend"
      options={(['week', 'month', 'year'] as const).map((id) => [id, label(id)] as const)}
    />
  );
}
