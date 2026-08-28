import { Fire, PlusCircle, UsersThree, X } from 'phosphor-react-native';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { Text } from '~/components/ui/text';

export type TodayTourTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const TOUR_STEPS = [
  {
    eyebrow: 'Today’s Check-in',
    title: 'Complete your daily check-in',
    description: 'Open this card, follow today’s move, and share your proof to earn Sweat Points.',
    icon: Fire,
  },
  {
    eyebrow: 'Your Community',
    title: 'Stay close to your group',
    description:
      'See the latest conversation, meet active members, and jump straight into your group chat.',
    icon: UsersThree,
  },
  {
    eyebrow: 'Your Activity',
    title: 'Log everyday wins',
    description:
      'Use Log activity to snap live proof of hydration, healthy meals, sleep, or 10,000 steps for extra points.',
    icon: PlusCircle,
  },
] as const;

type TodayFeatureTourProps = {
  step: number | null;
  target: TodayTourTarget | null;
  onNext: () => void;
  onSkip: () => void;
};

const BACKDROP = 'rgba(18, 13, 10, 0.72)';

export default function TodayFeatureTour({ step, target, onNext, onSkip }: TodayFeatureTourProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  if (step === null) return null;

  const stepIndex = Math.min(step, TOUR_STEPS.length - 1);
  const currentStep = TOUR_STEPS[stepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const horizontalInset = 12;
  const spotlight = target
    ? {
        x: Math.max(horizontalInset, target.x),
        y: Math.max(insets.top + 4, target.y),
        width: Math.min(screenWidth - horizontalInset * 2, target.width),
        height: target.height,
      }
    : null;
  const placeCardAbove = spotlight ? spotlight.y > screenHeight * 0.5 : false;
  const cardPosition = spotlight
    ? placeCardAbove
      ? { bottom: Math.max(screenHeight - spotlight.y + 18, insets.bottom + 18) }
      : { top: Math.min(spotlight.y + spotlight.height + 18, screenHeight - 260) }
    : { top: Math.max(insets.top + 180, screenHeight * 0.32) };

  return (
    <Modal transparent statusBarTranslucent animationType="fade" visible onRequestClose={onSkip}>
      <View className="flex-1">
        {spotlight ? (
          <>
            <Svg
              pointerEvents="auto"
              width={screenWidth}
              height={screenHeight}
              style={StyleSheet.absoluteFillObject}>
              <Defs>
                <Mask id="todayTourSpotlightMask">
                  <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill="#FFFFFF" />
                  <Rect
                    x={spotlight.x}
                    y={spotlight.y}
                    width={spotlight.width}
                    height={spotlight.height}
                    rx={28}
                    ry={28}
                    fill="#000000"
                  />
                </Mask>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={screenWidth}
                height={screenHeight}
                fill={BACKDROP}
                mask="url(#todayTourSpotlightMask)"
              />
            </Svg>
            <View
              pointerEvents="none"
              className="absolute rounded-[28px] border-[3px] border-primary-500"
              style={{
                left: spotlight.x,
                top: spotlight.y,
                width: spotlight.width,
                height: spotlight.height,
              }}
            />
          </>
        ) : (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: BACKDROP }}>
            <ActivityIndicator color="#FF5C1A" size="large" />
          </View>
        )}

        {spotlight ? (
          <View
            className="absolute left-5 right-5 rounded-[24px] bg-white p-5"
            style={[
              cardPosition,
              {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 14 },
                shadowOpacity: 0.22,
                shadowRadius: 24,
                elevation: 16,
              },
            ]}>
            <View className="flex-row items-start justify-between">
              <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-[#FFF0E8]">
                <StepIcon size={23} color="#FF5C1A" weight="duotone" />
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Skip Today screen tour"
                onPress={onSkip}
                className="h-9 w-9 items-center justify-center rounded-full bg-[#F2EFED]">
                <X size={16} color="#77716D" weight="bold" />
              </TouchableOpacity>
            </View>

            <Text className="mt-4 font-heading text-[10px] font-extrabold uppercase tracking-[1px] text-[#FF4B1F]">
              {currentStep.eyebrow}
            </Text>
            <Text className="mt-1 font-heading text-[21px] font-extrabold leading-7 text-[#1A1A1A]">
              {currentStep.title}
            </Text>
            <Text className="mt-2 font-body text-sm leading-5 text-[#77716D]">
              {currentStep.description}
            </Text>

            <View className="mt-5 flex-row items-center">
              <View className="mr-4 flex-1 flex-row items-center">
                {TOUR_STEPS.map((tourStep, index) => (
                  <View
                    key={tourStep.eyebrow}
                    className="mr-1.5 h-1.5 rounded-full"
                    style={{
                      width: index === stepIndex ? 24 : 7,
                      backgroundColor: index === stepIndex ? '#FF5C1A' : '#E6DFDA',
                    }}
                  />
                ))}
                <Text className="ml-1 font-body text-[11px] text-[#9A928D]">
                  {stepIndex + 1} of {TOUR_STEPS.length}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={isLastStep ? 'Finish Today screen tour' : 'Next tour step'}
                onPress={onNext}
                className="h-12 min-w-[112px] items-center justify-center rounded-[17px] bg-primary-500 px-5">
                <Text className="font-heading text-sm font-bold text-white">
                  {isLastStep ? 'Got it' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
