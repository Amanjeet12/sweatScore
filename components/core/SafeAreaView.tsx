import React from 'react';
import { Platform, SafeAreaView as RNSafeAreaView, ViewProps } from 'react-native';
import type { SafeAreaViewProps as ContextSafeAreaViewProps } from 'react-native-safe-area-context';

// React Native SafeAreaView uses ViewProps
type RNSafeAreaViewProps = ViewProps;

// Union type for props from both implementations
type SafeAreaViewProps = RNSafeAreaViewProps & ContextSafeAreaViewProps;

export const SafeAreaView: React.FC<SafeAreaViewProps> = ({ children, ...props }) => {
  if (Platform.OS === 'android') {
    // Use react-native-safe-area-context for Android (better navigation bar handling)
    return <RNSafeAreaView {...props}>{children}</RNSafeAreaView>;
  } else {
    // Use React Native's built-in SafeAreaView for iOS
    return <RNSafeAreaView {...props}>{children}</RNSafeAreaView>;
  }
};

export default SafeAreaView;
