import { Platform, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from './SafeAreaView';

/** Coach headers are custom; Android's built-in SafeAreaView does not inset them. */
export default function CoachSafeAreaView({ children, style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'android') {
    return (
      <SafeAreaView {...props} style={style}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <View
      {...props}
      style={[
        style,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          // The root navigator already reserves Android's bottom system inset.
        },
      ]}>
      {children}
    </View>
  );
}
