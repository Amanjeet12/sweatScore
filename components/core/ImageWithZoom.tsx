import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import ImageView from 'react-native-image-viewing';

import { cn } from '~/utils/cn';

export const ImageWithZoom = ({
  path,
  className,
  resizeMode = 'contain',
  size = 80,
}: {
  path: { uri: string };
  className?: string;
  resizeMode?: ImageContentFit;
  size?: number;
}) => {
  const [imageVisible, setImageVisible] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setImageVisible(true)}>
        <ExpoImage
          source={path}
          contentFit={resizeMode}
          style={{ width: size, height: size }}
          className={cn(className)}
        />
      </Pressable>
      <ImageView
        images={[path]}
        imageIndex={0}
        visible={imageVisible}
        onRequestClose={() => setImageVisible(false)}
      />
    </View>
  );
};
