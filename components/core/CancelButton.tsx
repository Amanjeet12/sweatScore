import { PressableProps, Text, View } from 'react-native';

import { HeaderButton } from '~/components/core/HeaderButton';

export const CancelButton = ({ text, ...props }: PressableProps & { text?: string }) => {
  return (
    <HeaderButton minWidth={64} {...props}>
      <View className="flex-row">{text && <Text className="text-link ml-1">{text}</Text>}</View>
    </HeaderButton>
  );
};
