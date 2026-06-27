import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';

export type Category = 'points' | 'steps' | 'activeMinutes' | 'moves';

const TABS: { id: Category; label: string }[] = [
  { id: 'points', label: 'Points' },
  { id: 'steps', label: 'Steps' },
  { id: 'activeMinutes', label: 'Active Min' },
  { id: 'moves', label: 'Progress' },
];

export type CategoryTabsProps = {
  value: Category;
  onChange: (c: Category) => void;
};

export default function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <View className="flex-row items-center justify-between">
      {TABS.map((t) => {
        const active = value === t.id;

        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onChange(t.id)}
            activeOpacity={0.7}>
            <Text
              className={
                active
                  ? 'font-heading text-base font-bold text-primary-500'
                  : 'font-body text-base text-[#838383]'
              }>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}