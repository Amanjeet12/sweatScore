import { CaretDown, Check } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const anchor = useRef<View>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const close = () => setPosition(null);

  // Modal's onOrientationChange also fires on initial presentation on iOS.
  // Close only when the actual window dimensions change.
  useEffect(() => {
    setPosition(null);
  }, [width, height]);

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Activity trend: ${label(value)}`}
          accessibilityState={{ expanded: position !== null }}
          onPress={() =>
            anchor.current?.measureInWindow((x, y, w, h) => {
              setPosition({
                left: Math.max(16, Math.min(x + w - 160, width - 176)),
                top: Math.max(
                  insets.top + 8,
                  y + h + 164 > height - insets.bottom ? y - 164 : y + h + 4
                ),
              });
            })
          }
          className="min-h-11 flex-row items-center gap-x-2 rounded-[20px] bg-[#F1EEEA] px-3">
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#1D1B1A]">
            {label(value)}
          </Text>
          <CaretDown size={14} color="#77716D" />
        </Pressable>
      </View>
      {position !== null && (
        <Modal transparent statusBarTranslucent visible animationType="fade" onRequestClose={close}>
          <View className="flex-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close period options"
              onPress={close}
              className="absolute inset-0 bg-black/10"
            />
            <View
              style={{ position: 'absolute', top: position.top, left: position.left, width: 160 }}
              className="rounded-[20px] border border-[#EEE8E3] bg-white p-2">
              {(['week', 'month', 'year'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === option }}
                  onPress={() => {
                    onChange(option);
                    close();
                  }}
                  className={`h-12 flex-row items-center justify-between rounded-xl px-3 ${value === option ? 'bg-[#FFF0E8]' : ''}`}>
                  <Text
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                    className="text-sm text-[#1D1B1A]">
                    {label(option)}
                  </Text>
                  {value === option ? <Check size={16} color="#FF5C35" weight="bold" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
