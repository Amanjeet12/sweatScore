import { Text, TouchableOpacity, View, TouchableOpacityProps } from 'react-native';

export const CancelButton = ({ text, ...props }: TouchableOpacityProps & { text?: string }) => {
  return (
    <TouchableOpacity {...props}>
      <View className="flex-row">{text && <Text className="text-link ml-1">{text}</Text>}</View>
    </TouchableOpacity>
  );
};
