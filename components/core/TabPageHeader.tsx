import { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

type Props = {
  title: string;
  eyebrow?: ReactNode;
  action?: ReactNode;
};

export default function TabPageHeader({ title, eyebrow, action }: Props) {
  return (
    <View className="pt-3">
      <View className="h-4 justify-center">{eyebrow}</View>
      <View className="mt-1 min-h-8 flex-row items-center justify-between gap-x-3">
        <Text className="min-w-0 flex-1 font-heading text-[26px] font-semibold leading-8 text-[#1A1A1A]">
          {title}
        </Text>
        {action ? <View className="ml-3 h-8 items-center justify-center">{action}</View> : null}
      </View>
    </View>
  );
}
