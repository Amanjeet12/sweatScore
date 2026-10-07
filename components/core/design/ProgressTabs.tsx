import { Pressable, View } from 'react-native';

import { prototypeColors as colors, prototypeTypography as type } from './prototypeStyles';

import { Text } from '~/components/ui/text';

export function ProgressTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        justifyContent: options.length > 2 ? 'space-between' : 'flex-start',
        gap: options.length > 2 ? 8 : 28,
      }}>
      {options.map(([id, title]) => {
        const active = value === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(id)}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingVertical: 10,
              borderBottomWidth: 3,
              borderBottomColor: active ? colors.icon : 'transparent',
              flexShrink: 1,
            }}>
            <Text
              style={[
                type.compactAction,
                {
                  color: active ? colors.icon : colors.muted,
                  fontSize: options.length > 2 ? 12 : 15,
                },
              ]}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
