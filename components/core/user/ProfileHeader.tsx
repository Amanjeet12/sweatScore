import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckInHeader } from '~/components/core/design/CheckInChrome';

type Props = {
  fallbackHref: Parameters<typeof router.replace>[0];
};

export default function ProfileHeader({ fallbackHref }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const goBack = () => {
    Keyboard.dismiss();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace(fallbackHref);
    }
  };

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: '#fff',
      }}>
      <CheckInHeader title="User Profile" onBack={goBack} />
    </View>
  );
}
