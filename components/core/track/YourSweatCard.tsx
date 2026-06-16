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
  moves: 'moves',
};

function valueFor(row: Record<string, number>, cat: Category): number {
  return row[cat] ?? 0;
}

function buildBars(
  period: Period,
  category: Category,
  overview: NonNullable<ReturnType<typeof useTrackOverview>>
): Bar[] {
  if (period === 'week') {
    return overview.currentWeek.days.map((d, i) => {
      const value = valueFor(d as any, category);
      return {
        label: DAY_LABELS[i],
        value,
        showMedal: category === 'points' && value >= 500,
      };
    });
  }
  if (period === 'month') {
    return overview.currentMonth.weeks.map((w, i) => {
      const value = valueFor(w as any, category);
      return {
        label: `Week ${i + 1}`,
        value,
        showMedal: category === 'points' && value >= 500,
      };
    });
  }
  // year
  const todayYearMonth = overview.currentYear.year + '-' + overview.currentMonth.yearMonth.slice(5);
  return overview.currentYear.months
    .filter((m) => m.yearMonth <= todayYearMonth)
    .map((m) => {
      const value = valueFor(m as any, category);
      const monthNum = parseInt(m.yearMonth.slice(5, 7), 10);
      const short = new Date(parseInt(m.yearMonth.slice(0, 4), 10), monthNum - 1, 1).toLocaleString(
        'en-US',
        { month: 'short' }
      );
      return {
        label: short,
        value,
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
    if (!overview) return [];
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
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Your Sweat</Text>
        <PeriodDropdown value={period} onChange={setPeriod} />
      </View>

      {/* Category tabs */}
      <View className="mt-4">
        <CategoryTabs value={category} onChange={setCategory} />
      </View>

      {/* Chart (optionally locked) */}
      {locked ? lockedChart : chart}

      {/* Lifetime footer — pro only */}
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

      {/* Free user: daily cap upsell — only on Week + Points view */}
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
