import type { FunctionReturnType } from 'convex/server';
import {
  Barbell,
  Check,
  Footprints,
  ForkKnife,
  MoonStars,
  MagnifyingGlass,
  YoutubeLogo,
} from 'phosphor-react-native';
import { Alert, Linking, TouchableOpacity, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { CoachCategory } from '~/shared/coachFoundation';
import { mealPlanSummary } from '~/shared/coachPlanCopy';
import { workoutYoutubeSearch } from '~/shared/coachYoutubeSearch';

export const PLAN_ROWS = [
  { category: 'workout', title: 'Workout', Icon: Barbell },
  { category: 'steps', title: 'Steps', Icon: Footprints },
  { category: 'meals', title: 'Meals', Icon: ForkKnife },
  { category: 'sleep', title: 'Sleep', Icon: MoonStars },
] as const;
const ORANGE = '#E8541E';
function concise(value: string) {
  return value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || value;
}

type Saved = FunctionReturnType<typeof api.revenueCatEntitlements.myPlan>;
type CheckIns = FunctionReturnType<typeof api.coachCheckIns.myToday> | undefined;

// Both entry points render recommendations from the same saved revision.
export default function CoachPlanItems({
  plan,
  checkIns,
  onCheckIn,
  canOpen = () => true,
}: {
  plan: NonNullable<Saved['plan']>;
  checkIns: CheckIns;
  onCheckIn: (category: CoachCategory) => void;
  canOpen?: (category: CoachCategory) => boolean;
}) {
  const output = plan.output;
  const workoutTarget =
    checkIns?.status === 'ready'
      ? checkIns.assignments.find((item) => item.category === 'workout')?.label
      : undefined;
  const search =
    plan.workout.type === 'rest' ? null : workoutYoutubeSearch(workoutTarget ?? output.workout);
  return (
    <>
      <View className="mt-7 gap-[22px]">
        {PLAN_ROWS.map(({ category, title, Icon }) => {
          const assignment = checkIns?.assignments.find((item) => item.category === category);
          const target =
            category === 'steps'
              ? plan.stepTarget > 0
                ? `${plan.stepTarget.toLocaleString('en-US')} steps`
                : output.steps
              : category === 'workout' && workoutTarget
                ? workoutTarget
                : category === 'meals'
                  ? mealPlanSummary(output.meals)
                  : concise(output[category]);
          const done = (assignment?.consumedCount ?? 0) > 0;
          return (
            <TouchableOpacity
              key={category}
              disabled={!canOpen(category)}
              accessibilityRole={canOpen(category) ? 'button' : 'text'}
              accessibilityLabel={`${title}: ${target}`}
              onPress={() => onCheckIn(category)}
              className="flex-row items-center">
              <View className="mr-[14px] h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF3EA]">
                <Icon size={24} color={ORANGE} />
              </View>
              <View className="min-w-0 flex-1 pr-3">
                <Text style={type.cardTitle}>{title}</Text>
                <Text style={type.supporting} className="mt-1">
                  {target}
                </Text>
              </View>
              <View className="h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-[#D9D9D9]">
                {done ? <Check size={17} color="#8A8A8A" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {search ? (
        <View className="mt-[34px]">
          <Text style={type.sheetSectionHeading}>Find your workout on YouTube</Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={`Search ${search.phrase} on YouTube`}
            onPress={() =>
              Linking.openURL(search.url).catch(() =>
                Alert.alert('YouTube could not be opened. Please try again.')
              )
            }
            className="mt-3 min-h-16 flex-row items-center rounded-[16px] border border-[#E0E0E0] bg-white px-4 py-4">
            <MagnifyingGlass size={24} color="#8A8A8A" />
            <Text style={type.search} className="mx-3 min-w-0 flex-1">
              {search.phrase}
            </Text>
            <YoutubeLogo size={32} color={ORANGE} weight="fill" />
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}
