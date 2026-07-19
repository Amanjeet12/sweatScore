import { useIsFocused } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import {
  AchievementPopupContent,
  getAchievementPopupDecisions,
} from '~/utils/achievement-popups';

type AchievementPopupManagerProps = {
  userId: string;
  yearMonth: string;
  monthlyPoints?: number;
  monthlyChallengeTarget?: number;
  lifetimePoints?: number;
  currentWeeklyStreak?: number;
  enabled?: boolean;
};

function getStorageKey(userId: string) {
  /*
   * SecureStore keys should only contain safe characters.
   */
  const safeUserId = userId.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `achievement_popups_${safeUserId}`;
}

async function getShownAchievementKeys(userId: string): Promise<Set<string>> {
  try {
    const storedValue = await SecureStore.getItemAsync(getStorageKey(userId));

    if (!storedValue) {
      return new Set();
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return new Set();
    }

    return new Set(
      parsedValue.filter(
        (value): value is string => typeof value === 'string'
      )
    );
  } catch (error) {
    console.warn('Unable to read achievement popup history:', error);

    return new Set();
  }
}

async function saveShownAchievementKeys(
  userId: string,
  shownKeys: ReadonlySet<string>
) {
  try {
    await SecureStore.setItemAsync(
      getStorageKey(userId),
      JSON.stringify(Array.from(shownKeys))
    );
  } catch (error) {
    console.warn('Unable to save achievement popup history:', error);

    throw error;
  }
}

export default function AchievementPopupManager({
  userId,
  yearMonth,
  monthlyPoints,
  monthlyChallengeTarget,
  lifetimePoints,
  currentWeeklyStreak,
  enabled = true,
}: AchievementPopupManagerProps) {
  const isFocused = useIsFocused();

  const [activePopup, setActivePopup] =
    useState<AchievementPopupContent | null>(null);

  const [isCheckingAchievements, setIsCheckingAchievements] =
    useState(false);

  useEffect(() => {
    if (
      !enabled ||
      !isFocused ||
      activePopup ||
      isCheckingAchievements
    ) {
      return;
    }

    let cancelled = false;

    const checkAchievements = async () => {
      setIsCheckingAchievements(true);

      try {
        const shownKeys = await getShownAchievementKeys(userId);

        const [decision] = getAchievementPopupDecisions(
          {
            yearMonth,
            monthlyPoints,
            monthlyChallengeTarget,
            lifetimePoints,
            currentWeeklyStreak,
          },
          shownKeys
        );

        if (!decision || cancelled) {
          return;
        }

        /*
         * Mark every reached achievement as consumed before
         * displaying the popup.
         */
        decision.consumedKeys.forEach((key) => {
          shownKeys.add(key);
        });

        /*
         * Await persistent storage before opening the modal.
         * This prevents app restarts or component remounts from
         * displaying the same achievement again.
         */
        await saveShownAchievementKeys(userId, shownKeys);

        if (!cancelled) {
          setActivePopup(decision.popup);
        }
      } catch (error) {
        console.warn('Achievement popup check failed:', error);
      } finally {
        if (!cancelled) {
          setIsCheckingAchievements(false);
        }
      }
    };

    void checkAchievements();

    return () => {
      cancelled = true;
    };
  }, [
    activePopup,
    currentWeeklyStreak,
    enabled,
    isCheckingAchievements,
    isFocused,
    lifetimePoints,
    monthlyChallengeTarget,
    monthlyPoints,
    userId,
    yearMonth,
  ]);

  const closePopup = () => {
    setActivePopup(null);
  };

  if (!activePopup) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closePopup}>
      <View
        accessibilityViewIsModal
        className="flex-1 items-center justify-center bg-black/40 px-5">
        <View className="relative w-full rounded-[28px] bg-white px-6 pb-6 pt-7">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close achievement popup"
            activeOpacity={0.85}
            onPress={closePopup}
            className="absolute right-4 top-4 z-10 h-10 w-10 items-center justify-center rounded-full bg-[#DEDEDE]">
            <Icon.X
              size={28}
              weight="bold"
              color="white"
            />
          </TouchableOpacity>

          <Text className="text-center text-[52px] leading-[62px]">
            {activePopup.icon}
          </Text>

          <Text className="mt-1 text-center font-heading text-2xl font-bold text-[#202020]">
            {activePopup.title}
          </Text>

          <Text className="mt-5 text-center font-heading text-base font-extrabold text-primary-500">
            {activePopup.highlight}
          </Text>

          <Text className="mx-2 mt-4 text-center font-body text-base leading-6 text-[#3C3C3C]">
            {activePopup.body}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            onPress={() => {
              closePopup();
              router.push('/share');
            }}
            className="mt-8 h-14 items-center justify-center rounded-full bg-primary-500">
            <Text className="font-heading text-base font-bold text-white">
              {activePopup.buttonText}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={closePopup}
            className="mt-4 py-1">
            <Text className="text-center font-body text-base font-medium text-[#3C3C3C]">
              Keep sweating
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}