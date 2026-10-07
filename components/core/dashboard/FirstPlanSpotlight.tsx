import {
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { Text } from '~/components/ui/text';

type Target = { x: number; y: number; width: number; height: number };

export default function FirstPlanSpotlight({
  target,
  onStart,
  onDismiss,
}: {
  target: Target | null;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get(Platform.OS === 'android' ? 'screen' : 'window');
  if (!target) return null;

  const margin = 12;
  // measureInWindow excludes Android's status bar; the translucent modal includes it.
  const modalOffsetY = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const x = Math.max(margin, target.x - 3);
  const y = Math.max(Platform.OS === 'android' ? 4 : insets.top + 4, target.y + modalOffsetY - 3);
  const right = Math.min(width - margin, target.x + target.width + 3);
  const bottom = Math.min(height - insets.bottom - 4, target.y + modalOffsetY + target.height + 3);
  const spotlightWidth = Math.max(1, right - x);
  const spotlightHeight = Math.max(1, bottom - y);
  const cardTop = bottom + 14;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onDismiss}>
      <View className="flex-1" accessibilityViewIsModal>
        <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <Mask id="firstPlanSpotlightMask">
              <Rect x={0} y={0} width={width} height={height} fill="#fff" />
              <Rect
                x={x}
                y={y}
                width={spotlightWidth}
                height={spotlightHeight}
                rx={24}
                fill="#000"
              />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgba(0,0,0,0.58)"
            mask="url(#firstPlanSpotlightMask)"
          />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: spotlightWidth,
            height: spotlightHeight,
            borderRadius: 24,
            borderWidth: 3,
            borderColor: '#FF5A1F',
          }}
        />
        <View
          className="absolute left-[22px] right-[22px] rounded-[22px] bg-white p-5"
          style={{ top: cardTop }}>
          <Text className="text-lg text-[#262626]" style={{ fontFamily: 'Inter_700Bold' }}>
            Start your first check-in
          </Text>
          <Text className="mt-2 font-body text-sm leading-5 text-[#77716D]">
            Answer five quick questions to personalise today's plan.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Let's go to today's plan questions"
            onPress={onStart}
            className="mt-5 min-h-11 items-center justify-center rounded-2xl bg-[#2A2A2A] px-5">
            <Text className="font-heading text-sm font-semibold text-white">Let's go</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
