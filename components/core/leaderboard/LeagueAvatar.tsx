import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

const WARM_COLORS = ['#b5502f', '#d4774a'];
export default function LeagueAvatar({
  name,
  uri,
  size = 44,
  ring = false,
  color,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  ring?: boolean;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);
  const cleanUri = uri?.trim();
  useEffect(() => setFailed(false), [cleanUri]);
  const safeName = name.trim() || 'User';
  const background =
    color ??
    WARM_COLORS[
      Array.from(safeName).reduce((hash, char) => hash + char.charCodeAt(0), 0) % WARM_COLORS.length
    ];
  return (
    <View
      style={{
        padding: ring ? 4 : 0,
        borderRadius: size,
        borderWidth: ring ? 2 : 0,
        borderColor: '#ff5a1f',
        backgroundColor: '#fff',
      }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {cleanUri && !failed ? (
          <Image
            source={{ uri: cleanUri }}
            style={{ width: size, height: size }}
            contentFit="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <Text
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: 'Inter_700Bold',
              fontWeight: 'normal',
              fontSize: size * 0.4,
              lineHeight: size * 0.5,
              color: '#fff',
              textAlign: 'center',
            }}>
            {safeName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}
