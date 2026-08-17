import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const COLORS = ['#FF5C1A', '#FFB020', '#7B61FF', '#23B5A9', '#F34E78'];
const PIECE_COUNT = 24;
const DURATION_MS = 1400;

export function ConfettiBurst({ onComplete }: { onComplete: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const screen = Dimensions.get('window');
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => {
        const angle = (-155 + (index * 130) / (PIECE_COUNT - 1)) * (Math.PI / 180);
        const distance = 110 + (index % 6) * 18;
        return {
          id: index,
          color: COLORS[index % COLORS.length],
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          fall: 180 + (index % 5) * 18,
          rotation: 180 + (index % 4) * 90,
          round: index % 4 === 0,
        };
      }),
    []
  );

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => finished && onComplete());
    return () => animation.stop();
  }, [onComplete, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.piece,
            {
              left: screen.width / 2,
              top: screen.height * 0.38,
              width: piece.round ? 7 : 6,
              height: piece.round ? 7 : 11,
              borderRadius: piece.round ? 4 : 1,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, piece.x],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0, piece.y, piece.y + piece.fall],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.rotation}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
