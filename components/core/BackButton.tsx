import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { Keyboard, PressableProps, Text, View } from 'react-native';

import { HeaderButton } from '~/components/core/HeaderButton';
import { colors } from '~/utils/constants';

type FallbackHref = Parameters<typeof router.replace>[0];

type BackButtonProps = PressableProps & {
  text?: string;
  fallbackHref?: FallbackHref;
};

export const goBackOrReplace = (fallbackHref: FallbackHref = '/(tabs)/dashboard') => {
  Keyboard.dismiss();

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
  const navigation = useNavigation();

  const handlePress: PressableProps['onPress'] = (event) => {
    if (onPress) {
      onPress(event);
      return;
    }

    Keyboard.dismiss();

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace(fallbackHref);
    }
  };

  return (
    <HeaderButton
      hitSlop={hitSlop ?? { top: 12, bottom: 12, left: 12, right: 12 }}
      minWidth={text ? 88 : 48}
      onPress={handlePress}
      {...props}>
      <View className="flex-row items-center">
        <Feather name="chevron-left" size={32} color={colors.primary} />
        {text && <Text className="text-link ml-1 text-xl font-bold text-primary-500">{text}</Text>}
      </View>
    </HeaderButton>
  );
};
