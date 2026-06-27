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
import { formatPoints } from '~/utils/formatter';

const DAY_LABELS = ['Mon', 'Tues', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];

const CATEGORY_LABEL: Record<Category, string> = {
  points: 'points',
  steps: 'steps',
  activeMinutes: 'active min',
  moves: 'progress',
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
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function valueFor(row: Record<string, any> | undefined, cat: Category): number {
  if (!row) return 0;

  if (cat === 'points') {
    return toNumber(row.points ?? row.totalFlooredPoints ?? row.totalPoints);
  }

  if (cat === 'steps') {
    return toNumber(row.steps ?? row.totalSteps);
  }

  if (cat === 'activeMinutes') {
    return toNumber(row.activeMinutes ?? row.totalZone2Minutes ?? row.zone2Minutes);
  }

  if (cat === 'moves') {
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

function getBarColor(period: Period, category: Category, value: number) {
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
      label: `Week ${week}`,
      value: 0,
      color: GREY,
      showMedal: false,
    }));
  }

  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
    (month) => ({
      label: month,
      value: 0,
      color: GREY,
      showMedal: false,
    })
  );
}

function buildBars(
  period: Period,
  category: Category,
  overview: NonNullable<ReturnType<typeof useTrackOverview>>
): Bar[] {
  if (period === 'week') {
    const days = overview.currentWeek?.days ?? [];

    return DAY_LABELS.map((label, i) => {
      const value = valueFor(days[i] as any, category);

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

    return [1, 2, 3, 4, 5].map((week, i) => {
      const value = valueFor(weeks[i] as any, category);

      return {
        label: `Week ${week}`,
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

  const todayYearMonth = `${currentYear.year}-${currentMonth.yearMonth.slice(5)}`;

  return currentYear.months
    .filter((m) => m.yearMonth <= todayYearMonth)
    .map((m) => {
      const value = valueFor(m as any, category);
      const monthNum = parseInt(m.yearMonth.slice(5, 7), 10);

      const short = new Date(
        parseInt(m.yearMonth.slice(0, 4), 10),
        monthNum - 1,
        1
      ).toLocaleString('en-US', {
        month: 'short',
      });

      return {
        label: short,
        value,
        color: getBarColor(period, category, value),
        showMedal: category === 'points' && value >= 500,
      };
    });
}

function useTrackOverview() {
  return useQuery(api.track.queries.getTrackOverview);
}

export default function YourSweatCard() {
  const overview = useTrackOverview();
  const { isPro } = useRevenueCat();

  const [period, setPeriod] = useState<Period>('week');
  const [category, setCategory] = useState<Category>('points');

  const bars = useMemo<Bar[]>(() => {
    if (!overview) return buildEmptyBars(period);

    return buildBars(period, category, overview);
  }, [overview, period, category]);

  const lifetimeValue = overview ? valueFor(overview.lifetime as any, category) : 0;
  const locked = !isPro && period !== 'week';

  const chart = (
    <View className="mt-6">
      <BarChart bars={bars} />
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
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <BarChart bars={bars} />
        </View>
      </TrackPaywallOverlay>
    </View>
  );

  return (
    <View
      className="mx-screen-x rounded-card bg-white p-5"
      style={{ marginHorizontal: 20, overflow: 'hidden' }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-xl font-bold text-[#1A1A1A]">
          Your Sweat
        </Text>

        <PeriodDropdown value={period} onChange={setPeriod} />
      </View>

      <View className="mt-4">
        <CategoryTabs value={category} onChange={setCategory} />
      </View>

      {locked ? lockedChart : chart}

      {isPro && (
        <View className="mt-4 flex-row items-center justify-between border-t border-[#EFEAE4] pt-4">
          <Text className="font-body text-base text-[#1A1A1A]">
            Lifetime {CATEGORY_LABEL[category]}
          </Text>

          <Text className="font-heading text-xl font-bold text-primary-500">
            {formatPoints(lifetimeValue)}
          </Text>
        </View>
      )}

      {!isPro && period === 'week' && category === 'points' && (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/(tabs)/rewards/paywall',
              params: { redirectTo: '/(tabs)/rewards' },
            })
          }
          activeOpacity={0.7}
          className="mt-4 flex-row items-center justify-center gap-x-1 border-t border-[#EFEAE4] pt-4">
          <Text className="font-body text-base text-[#1A1A1A]">
            10 pts daily cap.
          </Text>

          <Text className="font-body text-base font-semibold text-primary-500">
            Upgrade to keep earning
          </Text>

          <ArrowRight size={16} color="#F76B1C" weight="bold" />
        </TouchableOpacity>
      )}
    </View>
  );
}