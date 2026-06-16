import { Feather } from '@expo/vector-icons';
import { Text, TouchableOpacity, View, TouchableOpacityProps } from 'react-native';

import { colors } from '~/utils/constants';

export const BackButton = ({ text, ...props }: TouchableOpacityProps & { text?: string }) => {
  return (
    <TouchableOpacity {...props}>
      <View className="flex-row items-center">
        <Feather name="chevron-left" size={32} color={colors.primary} />
        {text && <Text className="text-link ml-1 text-xl font-bold text-primary-500">{text}</Text>}
      </View>
    </TouchableOpacity>
  );
};
