import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';

export const Avatar = ({
  uri,
  showLoader = false,
  size = 80,
  showGoldBorder = false,
  goToSettings = false,
}: {
  uri?: string;
  showLoader?: boolean;
  size?: number;
  showGoldBorder?: boolean;
  goToSettings?: boolean;
}) => {
  const [avatarLoading, setAvatarLoading] = useState<boolean>(true);

  const avatarImage = (
    <>
      <TouchableOpacity
        disabled={!goToSettings}
        onPress={() => {
          if (goToSettings) {
            router.push('/(tabs)/dashboard/settings');
          }
        }}>
        <ExpoImage
          source={uri ? { uri } : require('~/assets/avatar.png')}
          contentFit="contain"
          onLoadStart={() => setAvatarLoading(true)}
          onLoadEnd={() => setAvatarLoading(false)}
          style={{
            width: showGoldBorder ? size - 4 : size,
            height: showGoldBorder ? size - 4 : size,
            borderRadius: showGoldBorder ? (size - 4) / 2 : size / 2,
            borderWidth: showGoldBorder ? 0 : 1,
            borderColor: showGoldBorder ? 'transparent' : 'rgb(243, 244, 246)',
          }}
        />
        {showLoader && avatarLoading && uri ? (
          <View className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center">
            <ActivityIndicator size="small" color="#000" />
          </View>
        ) : null}
      </TouchableOpacity>
    </>
  );

  if (showGoldBorder) {
    return (
      <TouchableOpacity
        disabled={!goToSettings}
        onPress={() => {
          if (goToSettings) {
            router.push('/dashboard/settings');
          }
        }}>
        <LinearGradient
          colors={['#FFE6DA', '#FFE6DA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            padding: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {avatarImage}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return <View>{avatarImage}</View>;
};
