import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowUpRightIcon } from 'lucide-react-native';
import * as Icon from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Linking, Platform, TouchableOpacity, View } from 'react-native';

import SwipeableMissionCard from './SwipeableMissionCard';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { colors, externalLinks } from '~/utils/constants';
import { formatPoints } from '~/utils/formatter';
import { pointText } from '~/utils/helpers';
import { formatDateYYYYMMDD } from '~/utils/timezone';
import { CHALLENGE_TYPE } from '~/utils/types';

const MyCard = ({ refreshKey }: { refreshKey: number }) => {
  const [showCheckInAlertDialog, setShowCheckInAlertDialog] = useState(false);
  const [showStepsAlertDialog, setShowStepsAlertDialog] = useState(false);
  const [showSweatAlertDialog, setShowSweatAlertDialog] = useState(false);
  const [showMissionAlertDialog, setShowMissionAlertDialog] = useState(false);
  const [showMissionPointsAlertDialog, setShowMissionPointsAlertDialog] = useState(false);
  const [showPointsAlertDialog, setShowPointsAlertDialog] = useState(false);
  const [showMissionLeftDaysCountAlertDialog, setShowMissionLeftDaysCountAlertDialog] =
    useState(false);
  const yearMonth = useMemo(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  }, [refreshKey]);

  const formattedDate = useMemo(
    () => formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [refreshKey]
  );

  // const currentHour = useMemo(() => {
  //   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  //   const now = new Date();
  //   const hourString = now.toLocaleString('en-US', {
  //     timeZone: timezone,
  //     hour: 'numeric',
  //     hour12: false,
  //   });
  //   return parseInt(hourString, 10);
  // }, [refreshKey]);

  const { data: leaderboard, isPending } = useQuery(
    convexQuery(api.activities.getUserLeaderboardPosition, {
      yearMonth,
    })
  );

  const { data: pointsForDate, isPending: isPointsForDatePending } = useQuery(
    convexQuery(api.activities.getPointsForDate, {
      date: formattedDate,
    })
  );

  const { data: challenge, isPending: isChallengePending } = useQuery(
    convexQuery(api.dailyChallenges.getChallengeByDate, {
      date: formattedDate,
    })
  );

  const { isPro } = useRevenueCat();

  const progress = useMemo(() => {
    if (!challenge || !challenge.target || !pointsForDate) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.DOUBLE) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.REST) return null;

    if (challenge?.challengeType === CHALLENGE_TYPE.POINTS) {
      return Math.floor(((pointsForDate?.totalFlooredPoints ?? 0) / (challenge.target ?? 0)) * 100);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.POWERBOOST) {
      return Math.floor(((pointsForDate?.totalStepsTill11am ?? 0) / (challenge.target ?? 0)) * 100);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.SWEAT) {
      return Math.floor(((pointsForDate?.totalZone2Minutes ?? 0) / (challenge.target ?? 0)) * 100);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.STEPS) {
      return Math.floor(((pointsForDate?.totalSteps ?? 0) / (challenge.target ?? 0)) * 100);
    }

    return null;
  }, [
    challenge?.day,
    pointsForDate?.totalFlooredPoints,
    pointsForDate?.totalStepsTill11am,
    pointsForDate?.totalZone2Minutes,
    pointsForDate?.totalSteps,
    refreshKey,
  ]);

  const progressCountText = useMemo(() => {
    if (!challenge || !challenge.target || !pointsForDate) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.DOUBLE) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.REST) return null;

    if (challenge?.challengeType === CHALLENGE_TYPE.POINTS) {
      return formatPoints(pointsForDate?.totalFlooredPoints ?? 0);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.POWERBOOST) {
      return formatPoints(pointsForDate?.totalStepsTill11am ?? 0);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.SWEAT) {
      return formatPoints(Number(pointsForDate?.totalZone2Minutes ?? 0));
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.STEPS) {
      return formatPoints(pointsForDate?.totalSteps ?? 0);
    }

    return null;
  }, [
    challenge?.day,
    pointsForDate?.totalFlooredPoints,
    pointsForDate?.totalStepsTill11am,
    pointsForDate?.totalZone2Minutes,
    pointsForDate?.totalSteps,
    refreshKey,
  ]);

  const progressTypeText = useMemo(() => {
    if (!challenge || !challenge.target || !pointsForDate) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.DOUBLE) return null;
    if (challenge?.challengeType === CHALLENGE_TYPE.REST) return null;

    if (challenge?.challengeType === CHALLENGE_TYPE.POINTS) {
      return formatPoints(challenge.target);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.POWERBOOST) {
      return formatPoints(challenge.target);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.SWEAT) {
      return formatPoints(challenge.target);
    }
    if (challenge?.challengeType === CHALLENGE_TYPE.STEPS) {
      return formatPoints(challenge.target);
    }

    return null;
  }, [
    challenge?.day,
    pointsForDate?.totalFlooredPoints,
    pointsForDate?.totalStepsTill11am,
    pointsForDate?.totalZone2Minutes,
    pointsForDate?.totalSteps,
    challenge?.target,
    refreshKey,
  ]);

  const todayCardData = useMemo(
    () => ({
      title: "Today's challenge",
      description: challenge?.inAppCopy || '',
      progress,
      progressCount: progressCountText,
      progressType: progressTypeText,
      onInfoPress: () => setShowMissionPointsAlertDialog(true),
    }),
    [challenge?.inAppCopy, progress, progressCountText, progressTypeText]
  );

  if (isPending || isPointsForDatePending || isChallengePending) {
    return null;
  }

  return (
    <>
      <View className="mx-4 flex-col">
        <View
          className="mt-4 flex-1"
          style={{
            position: 'relative',
          }}>
          <View className="flex-1 flex-row items-stretch justify-between gap-x-4">
            {/* <TouchableOpacity
              onPress={() => setShowMissionLeftDaysCountAlertDialog(true)}
              className="flex-1 flex-col items-center rounded-card bg-[#FFE6DA] px-4 py-3"
              style={{
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                    }
                  : {
                      elevation: 3,
                    }),
              }}>
              <View
                className="flex-col items-center gap-y-2"
                style={{
                  backgroundColor: 'transparent',
                  borderRadius: 50,
                  ...(Platform.OS === 'ios'
                    ? {
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 30,
                      }
                    : {}),
                }}>
                <View>
                  <Text className="text-center text-sm font-semibold text-black/60">
                    Prize Draw
                  </Text>
                </View>
                <AnimatedCircularProgress
                  size={110}
                  width={15}
                  fill={
                    pointsForDate?.missionTarget
                      ? Math.floor(
                          ((pointsForDate.missionTarget -
                            (pointsForDate?.missionLeftDaysCount ?? 0)) /
                            pointsForDate.missionTarget) *
                            100
                        )
                      : 0
                  }
                  tintColor="#F58503"
                  backgroundColor="#FFD8C2">
                  {() => (
                    <>
                      {pointsForDate?.missionLeftDaysCount &&
                      pointsForDate?.missionLeftDaysCount > 0 ? (
                        <>
                          <Text className="text-lg font-semibold leading-tight">
                            {pointsForDate?.missionLeftDaysCount}
                          </Text>
                          <Text className="text-sm leading-tight"> missions</Text>
                        </>
                      ) : (
                        <Text className="text-sm leading-tight">You're eligible</Text>
                      )}

                      {pointsForDate?.missionLeftDaysCount &&
                      pointsForDate?.missionLeftDaysCount > 0 ? (
                        <Text className="text-sm leading-tight">to go</Text>
                      ) : (
                        <Text className="text-sm leading-tight">to win!</Text>
                      )}
                    </>
                  )}
                </AnimatedCircularProgress>
              </View>
            </TouchableOpacity> */}
            <TouchableOpacity
              className="flex-1 flex-col items-center rounded-card bg-[#FFE6DA] px-4 py-3"
              onPress={() => setShowMissionLeftDaysCountAlertDialog(true)}
              style={{
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                    }
                  : {
                      elevation: 3,
                    }),
              }}>
              <View className="flex-col items-center gap-y-2">
                <View>
                  <Text className="text-center text-sm font-semibold text-black/60">
                    Sweat Credits
                  </Text>
                </View>
                <View>
                  <View
                    style={{
                      backgroundColor: 'transparent',
                      borderRadius: 50,
                      ...(Platform.OS === 'ios'
                        ? {
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.3,
                            shadowRadius: 30,
                          }
                        : {}),
                    }}>
                    <Text
                      className="font-heading text-4xl font-extrabold leading-tight"
                      style={{
                        color: '#FF5C1A',
                        textAlign: 'center',
                      }}>
                      {pointsForDate?.missionCompletedDaysCount ?? 0}
                    </Text>
                  </View>
                  <View className="flex-col items-center">
                    <Text className="text-center text-sm leading-tight tracking-wide text-primary-700">
                      how to redeem
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-col items-center rounded-card bg-[#FFE6DA] px-4 py-3"
              onPress={() => setShowPointsAlertDialog(true)}
              style={{
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                    }
                  : {
                      elevation: 3,
                    }),
              }}>
              <View className="flex-col items-center gap-y-2">
                <View>
                  <Text className="text-center text-sm font-semibold text-black/60">
                    Sweat Points
                  </Text>
                </View>
                <View>
                  <View
                    style={{
                      backgroundColor: 'transparent',
                      borderRadius: 50,
                      ...(Platform.OS === 'ios'
                        ? {
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.3,
                            shadowRadius: 30,
                          }
                        : {}),
                    }}>
                    <Text
                      className="font-heading text-4xl font-extrabold leading-tight"
                      style={{
                        color: '#FF5C1A',
                        textAlign: 'center',
                      }}>
                      {formatPoints(leaderboard?.displayTotalPoints ?? 0)}
                    </Text>
                  </View>
                  <View className="flex-col items-center">
                    <Text className="text-center text-sm leading-tight tracking-wide text-primary-700">
                      how to win
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View className="mt-4">
          <SwipeableMissionCard todayCard={todayCardData} />
        </View>
        {pointsForDate?.totalUsersCompletedMissionCount ? (
          <Text className="mt-2 text-center text-sm text-gray-400">
            🔥 {formatPoints(pointsForDate?.totalUsersCompletedMissionCount)} Sweat Sisters have
            completed today&apos;s challenge.
          </Text>
        ) : null}

        <View className="mt-4">
          <TouchableOpacity
            onPress={() => setShowCheckInAlertDialog(true)}
            className="border-1 rounded-card border-[#EEEAE5] bg-white px-4 py-4"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <View className="h-14 flex-row items-center gap-x-4">
              <View className="h-14 w-14 flex-row items-center justify-center rounded-2xl bg-[#EEEAE5] p-2">
                <Icon.CheckFat weight="fill" color="#FF5C1A" />
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold text-black/70">Check in to the app</Text>
                </View>
                <View className="h-14 w-14 flex-row items-center justify-center rounded-full bg-[#FFC8B2]">
                  <Text className="text-xl font-bold text-white">
                    {pointText(pointsForDate?.checkInPoints, false, false)}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowStepsAlertDialog(true)}
            className="border-1 mt-4 rounded-card border-[#EEEAE5] bg-white px-4 py-4"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <View className="h-14 flex-row items-center gap-x-4">
              <View className="h-14 w-14 flex-row items-center justify-center rounded-2xl bg-[#EEEAE5] p-2">
                <Icon.Footprints weight="fill" color="#FF5C1A" />
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold text-black/70">Track your steps</Text>
                  <Text className="font-bold text-primary-500">
                    {formatPoints(pointsForDate?.totalSteps ?? 0)}
                  </Text>
                </View>
                <View className="h-14 w-14 flex-row items-center justify-center rounded-full bg-[#FFC8B2]">
                  <Text className="text-xl font-bold text-white">
                    {pointText(pointsForDate?.stepsPoints, false, false)}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSweatAlertDialog(true)}
            className="border-1 mt-4 rounded-card border-[#EEEAE5] bg-white px-4 py-4"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <View className="h-14 flex-row items-center gap-x-4">
              <View className="h-14 w-14 flex-row items-center justify-center rounded-2xl bg-[#EEEAE5] p-2">
                <Icon.Drop weight="fill" color="#FF5C1A" />
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold text-black/70">Log a workout</Text>
                  <Text className="font-bold text-primary-500">
                    {formatPoints(Number(pointsForDate?.totalZone2Minutes ?? 0))} min
                  </Text>
                </View>
                <View className="h-14 w-14 flex-row items-center justify-center rounded-full bg-[#FFC8B2]">
                  <Text className="text-xl font-bold text-white">
                    {pointText(pointsForDate?.zone2Points, false, false)}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowMissionAlertDialog(true)}
            className="border-1 mt-4 rounded-card border-[#EEEAE5] bg-white px-4 py-4"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <View className="h-14 flex-row items-center gap-x-4">
              <View className="h-14 w-14 flex-row items-center justify-center rounded-2xl bg-[#EEEAE5] p-2">
                <Icon.Target weight="bold" color="#FF5C1A" />
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold text-black/70">Complete challenge</Text>
                </View>
                <View className="h-14 w-14 flex-row items-center justify-center rounded-full bg-[#FFC8B2]">
                  <Text className="text-xl font-bold text-white">
                    {pointText(pointsForDate?.missionPoints, false, false)}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <MyCardAlertDialog
        showAlertDialog={showMissionPointsAlertDialog}
        handleClose={() => setShowMissionPointsAlertDialog(false)}
        title="Mission"
        body="Complete daily missions to stay consistent. Hit 20 missions to qualify for the monthly prize draw."
        icon={<Icon.Target size={16} weight="bold" color="white" />}
        iconBgColor={colors.primary}
        primaryButtonText="See prize details"
        handlePrimaryButtonPress={() => Linking.openURL(externalLinks.rewardsPage)}
      />

      <MyCardAlertDialog
        showAlertDialog={showCheckInAlertDialog}
        handleClose={() => setShowCheckInAlertDialog(false)}
        title="Check-in Points"
        body="Earn a point for every day you check into the app."
      />

      <MyCardAlertDialog
        showAlertDialog={showMissionAlertDialog}
        handleClose={() => setShowMissionAlertDialog(false)}
        title="Challenge Points"
        body="Complete daily challenges to earn extra points."
        icon={<Icon.Target size={16} weight="bold" color="white" />}
        iconBgColor={colors.primary}
      />

      <MyCardAlertDialog
        showAlertDialog={showStepsAlertDialog}
        handleClose={() => setShowStepsAlertDialog(false)}
        title="Steps Points"
        body="Earn points for daily steps synced from your device."
        icon={<Icon.Footprints size={16} weight="fill" color="white" />}
        iconBgColor={colors.primary}
      />

      <MyCardAlertDialog
        showAlertDialog={showSweatAlertDialog}
        handleClose={() => setShowSweatAlertDialog(false)}
        title="Sweat Points"
        body="Earn points for daily active minutes synced from your device."
        icon={<Icon.Drop size={16} weight="fill" color="white" />}
        iconBgColor={colors.primary}
      />

      <MyCardAlertDialog
        showAlertDialog={showMissionLeftDaysCountAlertDialog}
        handleClose={() => setShowMissionLeftDaysCountAlertDialog(false)}
        title="Sweat Credits"
        body={`1. Build your Sweat Credits\n2. Complete challenges to earn $1 in Sweat Credits\n3. Spend your balance inside the Rewards Shop`}
        icon={<Icon.CurrencyCircleDollar size={16} weight="bold" color="white" />}
        iconBgColor={colors.primary}
        primaryButtonText="Join now"
        handlePrimaryButtonPress={() => {
          setShowMissionLeftDaysCountAlertDialog(false);
          if (isPro) {
            router.push('/rewards');
          } else {
            router.push('/dashboard/paywall');
          }
        }}
      />

      <MyCardAlertDialog
        showAlertDialog={showPointsAlertDialog}
        handleClose={() => setShowPointsAlertDialog(false)}
        title="Points"
        body={`1. Join the members-only competition.\n2. Hit 500 points to stand a chance to win.\n3. One winner is selected.\n4. New competition each month.`}
        icon={<Icon.Gift size={16} weight="fill" color="white" />}
        iconBgColor={colors.primary}
        primaryButtonText="Join now"
        handlePrimaryButtonPress={() => {
          setShowPointsAlertDialog(false);
          if (isPro) {
            router.push('/share');
          } else {
            router.push('/dashboard/paywall');
          }
        }}
      />
    </>
  );
};

export const MyCardAlertDialog = ({
  showAlertDialog,
  handleClose,
  title,
  body,
  icon,
  iconColor,
  iconBgColor,
  handlePrimaryButtonPress,
  showIcon = true,
  primaryButtonText = 'Got it',
  secondaryButtonText = 'Cancel',
  showCloseButton = false,
  learnMoreLink = undefined,
  learnMoreText = 'Learn more',
}: {
  showAlertDialog: boolean;
  handleClose: () => void;
  title: string;
  body: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  handlePrimaryButtonPress?: () => void;
  showIcon?: boolean;
  primaryButtonText?: string;
  showCloseButton?: boolean;
  secondaryButtonText?: string;
  learnMoreLink?: string;
  learnMoreText?: string;
}) => {
  return (
    <AlertDialog isOpen={showAlertDialog} onClose={handleClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="rounded-card">
        <AlertDialogHeader>
          <View className="flex-row items-center justify-center gap-x-2">
            {showIcon ? (
              <>
                {icon ? (
                  iconBgColor ? (
                    <View
                      className="h-8 w-8 flex-row items-center justify-center rounded-full"
                      style={{ backgroundColor: iconBgColor }}>
                      {icon}
                    </View>
                  ) : (
                    icon
                  )
                ) : (
                  <Icon.CheckCircle size={32} color={colors.primary} weight="fill" />
                )}
              </>
            ) : null}
            <Text className="font-heading font-bold" size="2xl">
              {title}
            </Text>
          </View>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-8 mt-4">
          <Text size="lg" className="font-semibold">
            {body}
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <View className="w-full flex-col items-center justify-between gap-y-4">
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-16 w-full rounded-2xl"
              onPress={() => {
                handlePrimaryButtonPress?.();
                handleClose();
              }}>
              <ButtonText className="text-xl font-bold text-white">{primaryButtonText}</ButtonText>
            </Button>

            {showCloseButton && (
              <Button
                variant="outline"
                size="xl"
                action="negative"
                className="h-16 w-full rounded-2xl"
                onPress={handleClose}>
                <ButtonText className="text-xl font-bold text-red-500">
                  {secondaryButtonText}
                </ButtonText>
              </Button>
            )}

            {learnMoreLink && (
              <Button
                variant="link"
                action="primary"
                onPress={() => Linking.openURL(learnMoreLink)}>
                <ButtonText className="text-xl font-bold text-primary-500">
                  {learnMoreText}
                </ButtonText>
                <ButtonIcon as={ArrowUpRightIcon} />
              </Button>
            )}
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MyCard;
