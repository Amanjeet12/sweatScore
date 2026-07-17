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

    return `${result.toFixed(Math.abs(result) < 10 ? 1 : 0).replace(/\.0$/, '')}${suffix}`;
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

const CHART_HEIGHT = 220;
const VALUE_LABEL_HEIGHT = 40;
const BAR_WIDTH = 28;

const DEFAULT_GREY = '#D9D9D9';
const AXIS_COLOR = '#838383';
const GOAL_LINE_COLOR = '#1A1A1A';

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

function BarColumn({ bar, index, maxValue }: BarColumnProps) {
  const targetHeight =
    bar.value > 0 ? Math.min(CHART_HEIGHT, (bar.value / maxValue) * CHART_HEIGHT) : 0;

  const height = useSharedValue(0);

  const opacity = useSharedValue(0);

  useEffect(() => {
    height.value = 0;

    height.value = withDelay(
      index * 50,
      withTiming(targetHeight, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );

    opacity.value = 0;

    opacity.value = withDelay(
      index * 50 + 300,
      withTiming(1, {
        duration: 250,
      })
    );
  }, [height, opacity, index, targetHeight, bar.value]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const valueLabelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
          valueLabelStyle,
          {
            alignItems: 'center',
            marginBottom: 2,
            minHeight: 20,
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
          <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
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

export default function BarChart({ bars, target = 0, targetLabel = 'Goal'  }: BarChartProps) {
  const largestBarValue = Math.max(0, ...bars.map((bar) => bar.value));

  /*
   * Include the target in the chart scale so
   * the goal line always remains visible.
   */
  const largestValue = Math.max(1, largestBarValue, target);

  /*
   * Adds some spacing above the tallest value.
   */
  const maxValue = largestValue * 1.15;

  const targetHeight = target > 0 ? Math.min(CHART_HEIGHT, (target / maxValue) * CHART_HEIGHT) : 0;

  /*
   * Position is calculated from the top of
   * the complete chart area.
   */
  const targetTop = VALUE_LABEL_HEIGHT + CHART_HEIGHT - targetHeight;

  return (
    <View
      style={{
        minHeight: CHART_HEIGHT + 80,
      }}>
      <View
        style={{
          position: 'relative',
          height: CHART_HEIGHT + VALUE_LABEL_HEIGHT,
        }}>
        {/* Goal line */}
        {target > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: targetTop,
              left: 0,
              right: 0,
              zIndex: 5,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <View
              style={{
                flex: 1,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderTopColor: GOAL_LINE_COLOR,
              }}
            />

            <View
              style={{
                marginLeft: 6,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 2,
              }}>
              <Text className="font-body text-[11px] font-semibold text-[#1A1A1A]">
                {targetLabel} {formatChartValue(target)}
              </Text>
            </View>
          </View>
        )}

        {/* Bars */}
        <View
          className="flex-row items-end"
          style={{
            height: CHART_HEIGHT + VALUE_LABEL_HEIGHT,
            borderBottomWidth: 1,
            borderBottomColor: AXIS_COLOR,
          }}>
          {bars.map((bar, index) => (
            <BarColumn key={`${bar.label}-${index}`} bar={bar} index={index} maxValue={maxValue} />
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
            <Text numberOfLines={1} className="font-body text-sm text-[#838383]">
              {bar.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
