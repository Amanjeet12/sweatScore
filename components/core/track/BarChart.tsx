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

const formatChartValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const absoluteValue = Math.abs(value);

  const compact = (divisor: number, suffix: string) => {
    const result = value / divisor;

    return `${result
      .toFixed(Math.abs(result) < 10 ? 1 : 0)
      .replace(/\.0$/, '')}${suffix}`;
  };

  if (absoluteValue >= 1_000_000_000) {
    return compact(1_000_000_000, 'B');
  }

  if (absoluteValue >= 1_000_000) {
    return compact(1_000_000, 'M');
  }

  if (absoluteValue >= 1_000) {
    return compact(1_000, 'K');
  }

  return Math.round(value).toLocaleString();
};

const CHART_HEIGHT = 210;
const VALUE_LABEL_HEIGHT = 34;
const BAR_WIDTH = 28;

const DEFAULT_GREY = '#D9D9D9';
const AXIS_COLOR = '#A5A5A5';
const GOAL_LINE_COLOR = '#999999';
const ORANGE = '#F76B1C';

export type Bar = {
  label: string;
  value: number;
  showMedal: boolean;
  color?: string;
};

export type BarChartProps = {
  bars: Bar[];
  target?: number;
  targetLabel?: string;
};

type BarColumnProps = {
  bar: Bar;
  index: number;
  maxValue: number;
};

function BarColumn({
  bar,
  index,
  maxValue,
}: BarColumnProps) {
  const targetHeight =
    bar.value > 0
      ? Math.min(
          CHART_HEIGHT,
          (bar.value / maxValue) * CHART_HEIGHT
        )
      : 0;

  const animatedHeight = useSharedValue(0);
  const animatedOpacity = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = 0;

    animatedHeight.value = withDelay(
      index * 50,
      withTiming(targetHeight, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );

    animatedOpacity.value = 0;

    animatedOpacity.value = withDelay(
      index * 50 + 300,
      withTiming(1, {
        duration: 250,
      })
    );
  }, [
    animatedHeight,
    animatedOpacity,
    index,
    targetHeight,
  ]);

  const barStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
  }));

  return (
    <View
      style={{
        flex: 1,
        height: CHART_HEIGHT + VALUE_LABEL_HEIGHT,
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 2,
      }}>
      <Animated.View
        style={[
          labelStyle,
          {
            minHeight: VALUE_LABEL_HEIGHT,
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: 3,
          },
        ]}>
        {bar.showMedal && (
          <Image
            source={require('~/assets/icons/500points.png')}
            style={{
              width: 18,
              height: 18,
              marginBottom: 2,
            }}
            contentFit="contain"
          />
        )}

        {bar.value > 0 && (
          <Text
            numberOfLines={1}
            className="font-body text-xs font-semibold text-[#555555]">
            {formatChartValue(bar.value)}
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
  );
}

export default function BarChart({
  bars,
  target = 0,
  targetLabel = 'Goal',
}: BarChartProps) {
  const largestBarValue = Math.max(
    0,
    ...bars.map((bar) => bar.value)
  );

  const largestValue = Math.max(
    1,
    largestBarValue,
    target
  );

  const maxValue = largestValue * 1.18;

  const targetHeight =
    target > 0
      ? Math.min(
          CHART_HEIGHT,
          (target / maxValue) * CHART_HEIGHT
        )
      : 0;

  const targetTop =
    VALUE_LABEL_HEIGHT +
    CHART_HEIGHT -
    targetHeight;

  const achievedValue = Math.max(
    0,
    ...bars.map((bar) => bar.value)
  );

  const progressPercent =
    target > 0
      ? Math.min(
          100,
          Math.round(
            (achievedValue / target) * 100
          )
        )
      : 0;

  return (
    <View>
      {/* Goal information above chart */}
      {target > 0 && (
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="font-body text-xs text-[#838383]">
              Current best
            </Text>

            <Text className="font-heading text-base font-bold text-[#1A1A1A]">
              {formatChartValue(achievedValue)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 20,
              backgroundColor: '#FFF3EC',
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: ORANGE,
              }}
            />

            <Text className="font-body text-xs font-semibold text-[#F76B1C]">
              {targetLabel} {formatChartValue(target)}
            </Text>

            {/* <Text className="font-body text-xs text-[#838383]">
              · {progressPercent}%
            </Text> */}
          </View>
        </View>
      )}

      {/* Chart */}
      <View
        style={{
          position: 'relative',
          height: CHART_HEIGHT + VALUE_LABEL_HEIGHT,
        }}>
        {/* Goal line only */}
        {target > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: targetTop,
              left: 0,
              right: 0,
              zIndex: 1,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: GOAL_LINE_COLOR,
            }}
          />
        )}

        <View
          className="flex-row items-end"
          style={{
            height: CHART_HEIGHT + VALUE_LABEL_HEIGHT,
            borderBottomWidth: 1,
            borderBottomColor: AXIS_COLOR,
            zIndex: 2,
          }}>
          {bars.map((bar, index) => (
            <BarColumn
              key={`${bar.label}-${index}`}
              bar={bar}
              index={index}
              maxValue={maxValue}
            />
          ))}
        </View>
      </View>

      {/* Bottom labels */}
      <View
        className="flex-row"
        style={{
          marginTop: 8,
        }}>
        {bars.map((bar, index) => (
          <View
            key={`label-${bar.label}-${index}`}
            style={{
              flex: 1,
              alignItems: 'center',
            }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              className="font-body text-xs text-[#838383]">
              {bar.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}