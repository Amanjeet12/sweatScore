import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type AvatarProps = {
  uri?: string;
  name?: string;
  showLoader?: boolean;
  size?: number;
  showGoldBorder?: boolean;
  goToSettings?: boolean;
};

export const Avatar = ({
  uri,
  name,
  showLoader = false,
  size = 80,
  showGoldBorder = false,
  goToSettings = false,
}: AvatarProps) => {
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setAvatarLoading(Boolean(uri));
  }, [uri]);

  const firstLetter = name?.trim().charAt(0).toUpperCase() || '?';
  const shouldShowImage = Boolean(uri) && !imageFailed;

  const handlePress = () => {
    if (goToSettings) {
      router.push('/(tabs)/dashboard/settings');
    }
  };

  const innerSize = showGoldBorder ? size - 4 : size;

  const avatarContent = (
    <View
      style={{
        width: innerSize,
        height: innerSize,
        borderRadius: innerSize / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF5C1A',
        borderWidth: showGoldBorder ? 0 : 1,
        borderColor: showGoldBorder
          ? 'transparent'
          : 'rgb(243, 244, 246)',
      }}>
      {shouldShowImage ? (
        <ExpoImage
          source={{ uri }}
          contentFit="cover"
          onLoadStart={() => setAvatarLoading(true)}
          onLoad={() => {
            setAvatarLoading(false);
            setImageFailed(false);
          }}
          onError={() => {
            setAvatarLoading(false);
            setImageFailed(true);
          }}
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          }}
        />
      ) : (
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: innerSize * 0.4,
            lineHeight: innerSize * 0.48,
            fontFamily: 'Inter_700Bold',
            textAlign: 'center',
          }}>
          {firstLetter}
        </Text>
      )}

      {showLoader && avatarLoading && shouldShowImage ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}>
          <ActivityIndicator size="small" color="#000000" />
        </View>
      ) : null}
    </View>
  );

  return (
    <TouchableOpacity
      disabled={!goToSettings}
      activeOpacity={0.8}
      onPress={handlePress}>
      {showGoldBorder ? (
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
          {avatarContent}
        </LinearGradient>
      ) : (
        avatarContent
      )}
    </TouchableOpacity>
  );
};