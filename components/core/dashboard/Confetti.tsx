import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

interface ConfettiProps {
  trigger: number; // This will change when we want to trigger the animation
}

const CONFETTI_COUNT = 25;

const Confetti = ({ trigger }: ConfettiProps) => {
  const windowHeight = Dimensions.get('window').height;

  // Create refs outside of any conditional logic
  const animatedValues = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      translateY: new Animated.Value(-20),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // Store piece properties
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#FFA500', '#FFFFFF'];
      return {
        id: i,
        color: colors[Math.floor(Math.random() * colors.length)],
        left: Math.random() * 100,
        width: Math.random() * 4 + 3,
        height: Math.random() * 10 + 6,
        rotation: Math.random() * 360,
        delay: Math.random() * 500,
        duration: 2000 + Math.random() * 1000,
      };
    })
  ).current;

  useEffect(() => {
    if (trigger === 0) return;

    // Reset and regenerate random properties
    pieces.forEach((piece, index) => {
      const colors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#FFA500', '#FFFFFF'];
      piece.color = colors[Math.floor(Math.random() * colors.length)];
      piece.left = Math.random() * 100;
      piece.rotation = Math.random() * 360;
      piece.delay = Math.random() * 500;
      piece.duration = 2000 + Math.random() * 1000;

      // Reset animation values - ensure they start from invisible
      animatedValues[index].translateY.setValue(-20);
      animatedValues[index].opacity.setValue(0);

      // Start animations with slight delay to prevent flash
      setTimeout(() => {
        animatedValues[index].opacity.setValue(1);
        Animated.parallel([
          Animated.timing(animatedValues[index].translateY, {
            toValue: windowHeight * 0.4,
            duration: piece.duration,
            delay: piece.delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValues[index].opacity, {
            toValue: 0,
            duration: piece.duration,
            delay: piece.delay,
            useNativeDriver: true,
          }),
        ]).start();
      }, 16); // One frame delay
    });
  }, [trigger, windowHeight]);

  return (
    <>
      {pieces.map((piece, index) => (
        <Animated.View
          key={piece.id}
          style={{
            position: 'absolute',
            left: `${piece.left}%`,
            top: 0,
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            transform: [
              { translateY: animatedValues[index].translateY },
              { rotate: `${piece.rotation}deg` },
            ],
            opacity: animatedValues[index].opacity,
            borderRadius: piece.width / 2,
          }}
          pointerEvents="none"
        />
      ))}
    </>
  );
};

export default Confetti;
