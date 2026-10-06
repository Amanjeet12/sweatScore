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
  activity: Doc<'dailyActivities'> & {
    checkInPoints?: number;
    stepsPoints?: number;
    zone2Points?: number;
    missionPoints?: number;
    challengePoints?: number;
  };
}

export default function ActivityRow({ activity }: ActivityRowProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isCurrentUser = currentUser?._id === activity.userId;
  const canEdit = isCurrentUser && !activity.synced && activity.reviewStatus !== 'approved';

  const formattedDate = useMemo(() => {
    const [year, month, day] = activity.date.split('-').map((num) => parseInt(num, 10));
    return formatDateToLocaleString(new Date(year, month - 1, day));
  }, [activity.date]);

  // Calculate total points with fallback logic
  const totalPoints = useMemo(() => {
    // If displayTotalPoints exists and is greater than 0, use it
    if (activity.displayTotalPoints && activity.displayTotalPoints > 0) {
      return activity.displayTotalPoints;
    }

    // Otherwise, calculate from individual point breakdowns
    const checkInPoints = activity.checkInPoints ?? 0;
    const stepsPoints = activity.stepsPoints ?? 0;
    const zone2Points = activity.zone2Points ?? 0;
    const challengePoints = activity.challengePoints ?? 0;

    return checkInPoints + stepsPoints + zone2Points + challengePoints;
  }, [
    activity.displayTotalPoints,
    activity.checkInPoints,
    activity.stepsPoints,
    activity.zone2Points,
    activity.challengePoints,
  ]);

  const handleEdit = () => {
    router.push({
      pathname: '/activity/edit',
      params: {
        activityId: activity._id,
      },
    });
  };

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
