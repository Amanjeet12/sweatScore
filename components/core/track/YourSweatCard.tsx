import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import BarChart, { Bar } from './BarChart';
import CategoryTabs, { Category } from './CategoryTabs';
import PeriodDropdown, { Period } from './PeriodDropdown';
import TrackPaywallOverlay from './TrackPaywallOverlay';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { formatPoints } from '~/utils/formatter';

const DAY_LABELS = ['Mon', 'Tues', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const CATEGORY_LABEL: Record<Category, string> = {
  points: 'points',
  steps: 'steps',
  activeMinutes: 'active min',
  moves: 'challenges',
};

const PERIOD_LABEL: Record<Period, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

const ORANGE = '#F76B1C';
const GREY = '#D9D9D9';

const TARGETS: Record<Period, Partial<Record<Category, number>>> = {
  week: {
    points: 10,
    steps: 5000,
    activeMinutes: 50,
    moves: 1,
  },

  month: {
    points: 125,
    steps: 35000,
    activeMinutes: 150,
    moves: 5,
  },

  year: {
    points: 500,
    steps: 140000,
    activeMinutes: 600,
    moves: 20,
  },
};

function toNumber(value: unknown): number {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function valueFor(row: Record<string, any> | undefined, category: Category): number {
  if (!row) {
    return 0;
  }

  if (category === 'points') {
    return toNumber(row.points ?? row.totalFlooredPoints ?? row.totalPoints);
  }

  if (category === 'steps') {
    return toNumber(row.steps ?? row.totalSteps);
  }

  if (category === 'activeMinutes') {
    return toNumber(row.activeMinutes ?? row.totalZone2Minutes ?? row.zone2Minutes);
  }

  if (category === 'moves') {
    return toNumber(
      row.moves ??
        row.progress ??
        row.missionCompletedDaysCount ??
        row.completedMoves ??
        row.completedChallenges
    );
  }

  return 0;
}

function getBarColor(period: Period, category: Category, value: number): string {
  const target = TARGETS[period]?.[category];

  if (!target) {
    return value > 0 ? ORANGE : GREY;
  }

  return value >= target ? ORANGE : GREY;
}

function buildEmptyBars(period: Period): Bar[] {
  if (period === 'week') {
    return DAY_LABELS.map((label) => ({
      label,
      value: 0,
      color: GREY,
      showMedal: false,
    }));
  }

  if (period === 'month') {
    return [1, 2, 3, 4, 5].map((week) => ({
      label: `WK${week}`,
      value: 0,
      color: GREY,
      showMedal: false,
    }));
  }

  return MONTH_LABELS.map((month) => ({
    label: month,
    value: 0,
    color: GREY,
    showMedal: false,
  }));
}

function buildBars(
  period: Period,
  category: Category,
  overview: NonNullable<ReturnType<typeof useTrackOverview>>
): Bar[] {
  if (period === 'week') {
    const days = overview.currentWeek?.days ?? [];

    return DAY_LABELS.map((label, index) => {
      const value = valueFor(days[index] as any, category);

      return {
        label,
        value,
        color: getBarColor(period, category, value),
        showMedal: category === 'points' && value >= 500,
      };
    });
  }

  if (period === 'month') {
    const weeks = overview.currentMonth?.weeks ?? [];

    return [1, 2, 3, 4, 5].map((week, index) => {
      const value = valueFor(weeks[index] as any, category);

      return {
        label: `WK${week}`,
        value,
        color: getBarColor(period, category, value),
        showMedal: category === 'points' && value >= 500,
      };
    });
  }

  const currentYear = overview.currentYear;

  const currentMonth = overview.currentMonth;

  if (!currentYear?.months || !currentMonth?.yearMonth) {
    return buildEmptyBars('year');
  }

  const currentYearMonth = `${currentYear.year}-${currentMonth.yearMonth.slice(5)}`;

  return currentYear.months
    .filter((month) => month.yearMonth <= currentYearMonth)
    .map((month) => {
      const value = valueFor(month as any, category);

      const monthNumber = parseInt(month.yearMonth.slice(5, 7), 10);

      const shortLabel = new Date(
        parseInt(month.yearMonth.slice(0, 4), 10),
        monthNumber - 1,
        1
      ).toLocaleString('en-US', {
        month: 'short',
      });

      return {
        label: shortLabel,
        value,
        color: getBarColor(period, category, value),
        showMedal: category === 'points' && value >= 500,
      };
    });
}

function useTrackOverview(enabled: boolean) {
  return useQuery(api.track.queries.getTrackOverview, enabled ? {} : 'skip');
}

export default function YourSweatCard() {
  const currentUser = useAuthStore((state) => state.currentUser);

  const overview = useTrackOverview(!!currentUser?._id);

  const { isPro } = useRevenueCat();

  const [period, setPeriod] = useState<Period>('week');

  const [category, setCategory] = useState<Category>('points');

  const bars = useMemo<Bar[]>(() => {
    if (!overview) {
      return buildEmptyBars(period);
    }

    return buildBars(period, category, overview);
  }, [overview, period, category]);

  const lifetimeValue = overview ? valueFor(overview.lifetime as any, category) : 0;

  const targetValue = TARGETS[period]?.[category] ?? 0;

  const locked = !isPro && period !== 'week';

  const chart = (
    <View className="mt-6">
      <BarChart bars={bars} target={targetValue} targetLabel="Goal" />
    </View>
  );

  const lockedChart = (
    <View
      style={{
        marginHorizontal: -20,
        marginBottom: -20,
        marginTop: 24,
        overflow: 'hidden',
      }}>
      <TrackPaywallOverlay>
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 20,
          }}>
          <BarChart bars={bars} target={targetValue} targetLabel="Goal" />
        </View>
      </TrackPaywallOverlay>
    </View>
  );

  return (
    <View
      className="mx-screen-x rounded-card bg-white p-5"
      style={{
        marginHorizontal: 20,
        overflow: 'hidden',
      }}>
      <View className="flex-row items-center">
        <Text
          numberOfLines={1}
          className="flex-1 pr-3 font-heading text-xl font-bold text-[#1A1A1A]">
          Your Activity
        </Text>

        <PeriodDropdown value={period} onChange={setPeriod} />
      </View>

      <View className="mt-4">
        <CategoryTabs value={category} onChange={setCategory} />
      </View>

      {locked ? lockedChart : chart}

      {isPro && (
        <View>
          <View className="mt-3 flex-row items-center justify-between border-t border-[#EFEAE4] pt-3">
            <Text className="font-body text-base text-[#1A1A1A]">
              Lifetime {CATEGORY_LABEL[category]}
            </Text>

            <Text className="font-heading text-xl font-bold text-primary-500">
              {formatPoints(lifetimeValue)}
            </Text>
          </View>
        </View>
      )}

      {!isPro && period === 'week' && category === 'points' && (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/(tabs)/rewards/paywall',

              params: {
                redirectTo: '/(tabs)/rewards',
              },
            })
          }
          activeOpacity={0.7}
          className="mt-4 flex-row items-center justify-center gap-x-1 border-t border-[#EFEAE4] pt-4">
          <Text className="font-body text-base text-[#1A1A1A]">10 pts daily cap.</Text>

          <Text className="font-body text-base font-semibold text-primary-500">
            Upgrade to keep earning
          </Text>

          <ArrowRight size={16} color="#F76B1C" weight="bold" />
        </TouchableOpacity>
      )}
    </View>
  );
}
