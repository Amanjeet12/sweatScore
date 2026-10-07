import { router } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { colors } from '~/utils/constants';
import { formatDateToLocaleString, formatPoints } from '~/utils/formatter';
import { pointText } from '~/utils/helpers';

interface ActivityRowProps {
  compact?: boolean;
  activity: Doc<'dailyActivities'> & {
    checkInPoints?: number;
    stepsPoints?: number;
    zone2Points?: number;
    missionPoints?: number;
    challengePoints?: number;
    appOpenPoints?: number;
  };
}

export default function ActivityRow({ activity, compact = false }: ActivityRowProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isCurrentUser = currentUser?._id === activity.userId;
  const canEdit = isCurrentUser && !activity.synced && activity.reviewStatus !== 'approved';

  const formattedDate = useMemo(() => {
    const [year, month, day] = activity.date.split('-').map((num) => parseInt(num, 10));
    return formatDateToLocaleString(new Date(year, month - 1, day));
  }, [activity.date]);

  // Calculate total points with fallback logic
  const totalPoints = useMemo(() => {
    // Use the awarded total when available (it may include a daily cap).
    if (activity.displayTotalPoints !== undefined) {
      return activity.displayTotalPoints;
    }

    // Otherwise, calculate from individual point breakdowns
    const checkInPoints = activity.checkInPoints ?? 0;
    const stepsPoints = activity.stepsPoints ?? 0;
    const zone2Points = activity.zone2Points ?? 0;
    const challengePoints = activity.challengePoints ?? 0;
    const appOpenPoints = activity.appOpenPoints ?? 0;

    return checkInPoints + stepsPoints + zone2Points + challengePoints + appOpenPoints;
  }, [
    activity.displayTotalPoints,
    activity.checkInPoints,
    activity.stepsPoints,
    activity.zone2Points,
    activity.challengePoints,
    activity.appOpenPoints,
  ]);

  const handleEdit = () => {
    router.push({
      pathname: '/activity/edit',
      params: {
        activityId: activity._id,
      },
    });
  };

  if (compact) {
    return (
      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#ececec',
          backgroundColor: '#fff',
          padding: 18,
          gap: 16,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          <Text style={[type.cardTitle, { flex: 1 }]}>{formattedDate}</Text>
          {canEdit ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Edit activity"
              onPress={handleEdit}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon.PencilLine size={20} color="#6f6f6f" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
          <Text
            style={{ fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 38, color: '#ff5a1f' }}>
            {formatPoints(Math.floor(totalPoints))}
          </Text>
          <Text style={type.supporting}>Sweat Points</Text>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#ececec',
            paddingTop: 14,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}>
          {[
            { label: 'Check-in', Icon: Icon.CheckFat, points: activity.checkInPoints },
            { label: 'Steps', Icon: Icon.Footprints, points: activity.stepsPoints },
            { label: 'Active minutes', Icon: Icon.Drop, points: activity.zone2Points },
            { label: 'Challenges', Icon: Icon.Trophy, points: activity.challengePoints },
          ].map(({ label, Icon: ActivityIcon, points }) => (
            <View
              key={label}
              style={{
                flexBasis: '45%',
                flexGrow: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: '#fff3ea',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <ActivityIcon size={16} weight="fill" color="#e8541e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.smallCaption}>{label}</Text>
                <Text style={type.compactCardTitle}>{pointText(points, false)}</Text>
              </View>
            </View>
          ))}
        </View>
        {activity.appOpenPoints ? (
          <Text style={type.smallCaption}>
            Includes {activity.appOpenPoints} {activity.appOpenPoints === 1 ? 'point' : 'points'}
            {' for opening the app.'}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mx-4 mb-5 flex-row items-center rounded-lg py-3">
      <View className="flex-1">
        <View className="flex-col gap-y-2">
          <View className="mx-4 flex-row gap-x-2">
            <View className="flex-1 flex-row items-center gap-x-1">
              <Text style={[type.cardTitle, { flexShrink: 1 }]}>{formattedDate}</Text>
            </View>
            <View className="flex-row items-center gap-x-2">
              {canEdit ? (
                <View className="flex-row items-center gap-x-2">
                  <TouchableOpacity onPress={handleEdit}>
                    <Icon.PencilLine size={20} weight="duotone" />
                  </TouchableOpacity>
                  {/* <TouchableOpacity>
                    <Icon.Trash size={20} color={colors.error} weight="duotone" />
                  </TouchableOpacity> */}
                </View>
              ) : null}
            </View>
          </View>
          <View className="mx-2 items-center">
            <View
              className="border-2 border-[#EEEAE5]"
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 24,
                marginHorizontal: 0,

                // For Android
                position: 'relative',
                width: '100%',
              }}>
              <View className="flex-col items-center justify-center">
                <View
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: 12,

                    // For Android
                  }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                    className="text-6xl font-bold leading-tight"
                    style={{
                      color: colors.primary,
                      textAlign: 'center',
                    }}>
                    {formatPoints(Math.floor(totalPoints))}
                  </Text>
                </View>
                <View className="flex-col items-center">
                  <Text className="text-2xl font-bold tracking-wide text-primary-500">
                    Sweat Points
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {/* Wrap the existing breakdown instead of squeezing four groups into one row. */}
          <View className="mx-4 mt-3 flex-row flex-wrap gap-3">
            {[
              { key: 'checkIn', Icon: Icon.CheckFat, points: activity.checkInPoints },
              { key: 'steps', Icon: Icon.Footprints, points: activity.stepsPoints },
              { key: 'zone2', Icon: Icon.Drop, points: activity.zone2Points },
              { key: 'challenge', Icon: Icon.Trophy, points: activity.challengePoints },
            ].map(({ key, Icon: ActivityIcon, points }) => (
              <View
                key={key}
                style={{ flexBasis: 128, flexGrow: 1, flexShrink: 0 }}
                className="min-h-12 flex-row items-center gap-x-3 py-2">
                <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-200">
                  <ActivityIcon size={16} weight="fill" color="black" />
                </View>
                <Text style={[type.body, { flex: 1, color: '#374151' }]}>
                  {pointText(points, false)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
