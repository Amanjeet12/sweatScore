import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View, TouchableOpacityProps } from 'react-native';

import { colors } from '~/utils/constants';

type FallbackHref = Parameters<typeof router.replace>[0];

type BackButtonProps = TouchableOpacityProps & {
  text?: string;
  fallbackHref?: FallbackHref;
};

export const goBackOrReplace = (fallbackHref: FallbackHref = '/(tabs)/dashboard') => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
};

export const BackButton = ({
  text,
  onPress,
  fallbackHref = '/(tabs)/dashboard',
  hitSlop,
  ...props
}: BackButtonProps) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      hitSlop={hitSlop ?? { top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={onPress ?? (() => goBackOrReplace(fallbackHref))}
      {...props}>
      <View className="flex-row items-center">
        <Feather name="chevron-left" size={32} color={colors.primary} />
        {text && <Text className="text-link ml-1 text-xl font-bold text-primary-500">{text}</Text>}
      </View>
    </TouchableOpacity>
  );
};
