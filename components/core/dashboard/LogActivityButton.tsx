import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Drop,
  Footprints,
  ForkKnife,
  MoonStars,
  Plus,
  X,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import {
  ACTIVITY_SUBMISSION_OPTIONS,
  ActivitySubmissionMode,
  LOGGED_ACTIVITIES,
  LoggedActivityKey,
  getLoggedActivity,
  getRandomActivityCaption,
} from '~/shared/loggedActivities';

const PRIMARY = '#FF5C1A';

function ActivityIcon({ name, size = 22 }: { name: string; size?: number }) {
  const props = { size, color: PRIMARY, weight: 'duotone' as const };

  switch (name) {
    case 'hydration':
      return <Drop {...props} />;
    case 'footprints':
      return <Footprints {...props} />;
    case 'sleep':
      return <MoonStars {...props} />;
    case 'meal':
      return <ForkKnife {...props} />;
    default:
      return <Plus {...props} />;
  }
}

function SubmissionIcon() {
  return <Camera size={21} color={PRIMARY} />;
}

export default function LogActivityButton({ tourTargetRef }: { tourTargetRef?: RefObject<View> }) {
  const insets = useSafeAreaInsets();
  const { requireSubscription } = useSubscriptionGuard();
  const pulse = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedActivityKey, setSelectedActivityKey] = useState<LoggedActivityKey | null>(null);
  const [isOpeningMedia, setIsOpeningMedia] = useState(false);

  const selectedActivity = getLoggedActivity(selectedActivityKey ?? undefined);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const close = () => {
    if (isOpeningMedia) return;
    setIsOpen(false);
    setSelectedActivityKey(null);
  };

  const openMedia = async (mode: ActivitySubmissionMode) => {
    if (!selectedActivity || isOpeningMedia) return;

    const allowed = requireSubscription({
      redirectTo: '/(tabs)/dashboard',
      source: 'activity_log_proof',
    });

    if (!allowed) return;

    setIsOpeningMedia(true);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to capture your activity proof.');
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        selectionLimit: 1,
      };

      const result = await ImagePicker.launchCameraAsync(options);

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const caption = getRandomActivityCaption(selectedActivity.key);
      setIsOpen(false);
      setSelectedActivityKey(null);

      router.push({
        pathname: '/posts/new',
        params: {
          activityKey: selectedActivity.key,
          activityMode: mode,
          activityCaption: caption,
          activityMediaUri: asset.uri,
          activityMediaType: 'image',
          activityMediaWidth: String(asset.width ?? 0),
          activityMediaHeight: String(asset.height ?? 0),
          activityMediaMimeType: asset.mimeType ?? 'image/jpeg',
          activityMediaFileName: asset.fileName ?? '',
        },
      });
    } catch (error) {
      console.warn('Unable to open activity proof picker:', error);
      Alert.alert('Could not open media', 'Please try choosing your activity proof again.');
    } finally {
      setIsOpeningMedia(false);
    }
  };

  return (
    <>
      <View ref={tourTargetRef} collapsable={false} className="mt-5 h-14 w-full justify-center">
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 17,
            backgroundColor: PRIMARY,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.04] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
            ],
          }}
        />

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Log optional activity"
          onPress={() => setIsOpen(true)}
          className="h-14 w-full flex-row items-center justify-between rounded-[17px] bg-primary-500 px-[22px]"
          style={{
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 14,
            elevation: 4,
          }}>
          <Text className="font-heading text-base font-bold text-white">Log activity</Text>
          <ArrowRight size={23} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="slide" visible={isOpen} onRequestClose={close}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close activity options"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(16, 12, 10, 0.68)' }]}
            onPress={close}
          />

          <View
            className="max-h-[86%] rounded-t-[30px] bg-white px-5 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-[#CEC7C2]" />

            <View className="mb-4 flex-row items-start justify-between">
              <View className="min-w-0 flex-1 pr-4">
                <View className="flex-row items-center">
                  {selectedActivity ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Back to activities"
                      onPress={() => setSelectedActivityKey(null)}
                      className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-[#FFF0E8]">
                      <ArrowLeft size={14} color={PRIMARY} weight="bold" />
                    </TouchableOpacity>
                  ) : null}
                  <Text className="font-heading text-[10px] font-extrabold uppercase tracking-[1px] text-[#FF4B1F]">
                    Log activity
                  </Text>
                  <View className="ml-2 rounded-full bg-[#F1EFED] px-2.5 py-1">
                    <Text className="font-heading text-[9px] font-bold text-[#77716D]">
                      Optional
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 font-heading text-[22px] font-extrabold leading-7 text-[#1A1A1A]">
                  {selectedActivity ? 'Add your proof' : 'What did you do today?'}
                </Text>
                <Text className="mt-1 font-body text-xs leading-4 text-[#8A827D]">
                  {selectedActivity
                    ? selectedActivity.proof
                    : 'Choose an activity to share with your community.'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={close}
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F2EFED]">
                <X size={18} color="#77716D" weight="bold" />
              </TouchableOpacity>
            </View>

            {selectedActivity ? (
              <View>
                <View className="mb-3 rounded-[18px] bg-[#FFF8F4] p-4">
                  <View className="flex-row items-center">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-[14px] bg-[#FFF0E8]">
                      <ActivityIcon name={selectedActivity.icon} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-heading text-sm font-bold text-[#1A1A1A]">
                          {selectedActivity.title}
                        </Text>
                        <Text className="font-heading text-xs font-extrabold text-[#E94F12]">
                          +{selectedActivity.basePoints} pts
                        </Text>
                      </View>
                      <Text className="mt-1 font-body text-xs leading-4 text-[#77716D]">
                        {selectedActivity.goal}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="overflow-hidden rounded-[20px] border border-[#E8E1DC]">
                  {ACTIVITY_SUBMISSION_OPTIONS.map((option, index) => (
                    <TouchableOpacity
                      key={option.mode}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      disabled={isOpeningMedia}
                      onPress={() => openMedia(option.mode)}
                      className="h-[74px] flex-row items-center px-3.5"
                      style={{
                        opacity: isOpeningMedia ? 0.6 : 1,
                        borderBottomWidth: index === ACTIVITY_SUBMISSION_OPTIONS.length - 1 ? 0 : 1,
                        borderBottomColor: '#EEE7E2',
                      }}>
                      <View className="mr-3 h-11 w-11 items-center justify-center rounded-[14px] bg-[#FFF0E8]">
                        <SubmissionIcon />
                      </View>
                      <View className="min-w-0 flex-1 pr-2">
                        <Text className="font-heading text-sm font-bold text-[#1A1A1A]">
                          {option.label}
                        </Text>
                        <Text className="mt-0.5 font-body text-[11px] text-[#8A827D]">
                          {option.description}
                        </Text>
                      </View>
                      <ArrowRight size={17} color={PRIMARY} weight="bold" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-y-2.5 pb-1">
                  {LOGGED_ACTIVITIES.map((activity) => (
                    <TouchableOpacity
                      key={activity.key}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={`${activity.title}, ${activity.basePoints} points`}
                      onPress={() => setSelectedActivityKey(activity.key)}
                      className="min-h-[82px] flex-row items-center rounded-[18px] border border-[#E8E1DC] bg-[#FFFCFA] px-3.5 py-3">
                      <View className="mr-3 h-11 w-11 items-center justify-center rounded-[14px] bg-[#FFF0E8]">
                        <ActivityIcon name={activity.icon} />
                      </View>
                      <View className="min-w-0 flex-1 pr-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="font-heading text-sm font-bold text-[#1A1A1A]">
                            {activity.title}
                          </Text>
                          <Text className="font-heading text-[11px] font-extrabold text-[#E94F12]">
                            +{activity.basePoints} pts
                          </Text>
                        </View>
                        <Text className="mt-1 font-body text-[11px] leading-4 text-[#6F6864]">
                          {activity.goal}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
