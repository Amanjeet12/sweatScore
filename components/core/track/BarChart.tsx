import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '~/components/ui/text';

const formatPoints = (points: number): string => {
  if (!Number.isFinite(points)) return '0';

  const absolutePoints = Math.abs(points);

  const compact = (divisor: number, suffix: string) => {
    const value = points / divisor;

    return `${value.toFixed(Math.abs(value) < 10 ? 1 : 0).replace(/\.0$/, '')}${suffix}`;
  };

  if (absolutePoints >= 1_000_000_000) {
    return compact(1_000_000_000, 'B');
  }

  if (absolutePoints >= 1_000_000) {
    return compact(1_000_000, 'M');
  }

  if (absolutePoints >= 1_000) {
    return compact(1_000, 'K');
  }

  return Math.round(points).toLocaleString();
};

const CHART_HEIGHT = 220;
const BAR_WIDTH = 28;
const DEFAULT_GREY = '#D9D9D9';

export type Bar = {
  label: string;
  value: number;
  showMedal: boolean;
  color?: string;
};

export type BarChartProps = {
  bars: Bar[];
};

function BarColumn({ bar, index, maxValue }: { bar: Bar; index: number; maxValue: number }) {
  const targetHeight = bar.value > 0 ? (bar.value / maxValue) * CHART_HEIGHT : 0;

  const h = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    h.value = 0;
    h.value = withDelay(
      index * 50,
      withTiming(targetHeight, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );

    opacity.value = 0;
    opacity.value = withDelay(index * 50 + 300, withTiming(1, { duration: 250 }));
  }, [targetHeight, bar.value, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: h.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className="items-center" style={{ flex: 1 }}>
      <View
        style={{
          height: CHART_HEIGHT + 40,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
        <Animated.View style={[labelStyle, { alignItems: 'center', marginBottom: 2 }]}>
          {bar.showMedal && (
            <Image
              source={require('~/assets/icons/500points.png')}
              style={{ width: 18, height: 18, marginBottom: 2 }}
              contentFit="contain"
            />
          )}

          {bar.value > 0 && (
            <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
              {formatPoints(bar.value)}
            </Text>
          )}
        </Animated.View>

        <Animated.View
          style={[
            barStyle,
            {
              width: BAR_WIDTH,
              backgroundColor: bar.color ?? DEFAULT_GREY,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function BarChart({ bars }: BarChartProps) {
  const maxValue = Math.max(1, ...bars.map((b) => b.value));

  return (
    <View style={{ minHeight: CHART_HEIGHT + 80 }}>
      <View className="flex-row items-end" style={{ height: CHART_HEIGHT + 40 }}>
        {bars.map((bar, i) => (
          <BarColumn key={`${bar.label}-${i}`} bar={bar} index={i} maxValue={maxValue} />
        ))}
      </View>

      <View className="flex-row" style={{ marginTop: 8 }}>
        {bars.map((bar, i) => (
          <View key={`label-${bar.label}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <Text className="font-body text-sm text-[#838383]">{bar.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
