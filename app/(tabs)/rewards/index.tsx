import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { router, Stack } from 'expo-router';
import { Camera, LockSimple, ShareNetwork } from 'phosphor-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Share from 'react-native-share';
import Svg, { Line } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import SafeAreaView from '~/components/core/SafeAreaView';
import TrendRangeDropdown from '~/components/core/track/TrendRangeDropdown';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { TARGETS, getBarColor } from '~/shared/activityGoals';
import { useAuthStore } from '~/store/useAuthStore';

type TrendMetric = 'challenges' | 'steps' | 'activeMinutes' | 'points';
type TrendRange = 'week' | 'month' | 'year';
type ProgressPhoto = {
  _id: string;
  weekStart: string;
  frontUrl: string | null;
  sideUrl: string | null;
};
type TrendDatum = {
  key: string;
  label: string;
  points: number;
  steps: number;
  activeMinutes: number;
  challenges: number;
};
type DashboardData = {
  currentMonth: string;
  currentWeekStart: string;
  canLogCurrentWeek: boolean;
  summary: { currentStreak: number; monthPoints: number; completedCheckIns: number };
  photos: ProgressPhoto[];
  trend: Record<TrendRange, TrendDatum[]>;
  lifetime: { points: number; steps: number; activeMinutes: number; challenges: number };
  monthlyGoal: {
    title: string;
    targetPoints: number;
    earnedPoints: number;
  } | null;
};

const PRIMARY = '#FF5C35';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)));
}

function formatCompactNumber(value: number) {
  const roundedValue = Math.max(0, Math.round(value));
  if (roundedValue < 1000) return formatNumber(roundedValue);

  const thousands = roundedValue / 1000;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: thousands < 10 ? 1 : 0,
  }).format(thousands)}k`;
}

function monthName(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <View className="min-w-0 flex-1 px-2">
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="font-body text-[10px] leading-4 text-[#817A76]">
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="my-1 text-lg leading-6 text-[#1D1B1A]"
        style={{ fontFamily: 'Inter_600SemiBold' }}>
        {value}
      </Text>
      {unit ? (
        <Text numberOfLines={1} className="font-body text-[10px] leading-4 text-[#817A76]">
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export default function TabTrack() {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);
  const progress = useQuery(api.progressPhotos.getDashboard, currentUser?._id ? {} : 'skip') as
    | DashboardData
    | undefined;
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const createPost = useMutation(api.posts.createPost);
  const comparisonRef = useRef<View>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [view, setView] = useState<'front' | 'side'>('front');
  const [metric, setMetric] = useState<TrendMetric>('points');
  const [range, setRange] = useState<TrendRange>('year');
  const [sharing, setSharing] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });
  const { requireSubscription } = useSubscriptionGuard();

  const openProgressPhoto = () => {
    if (
      !requireSubscription({
        redirectTo: '/progress-photo',
        source: 'progress_photo_upload',
      })
    )
      return;
    router.push('/progress-photo');
  };

  const photos = progress?.photos ?? [];
  const currentPhoto = photos[selectedWeekIndex] ?? photos[photos.length - 1];
  const baselinePhoto = photos[0];
  const showSide = view === 'side' && Boolean(baselinePhoto?.sideUrl && currentPhoto?.sideUrl);
  const comparisonLeft = showSide ? baselinePhoto?.sideUrl : baselinePhoto?.frontUrl;
  const comparisonRight = showSide ? currentPhoto?.sideUrl : currentPhoto?.frontUrl;
  const currentWeekNumber = currentPhoto
    ? photos.findIndex((photo) => photo._id === currentPhoto._id) + 1
    : 1;
  const nextWeekNumber = photos.length + 1;

  const trend = useMemo(() => {
    const selectedTrend = progress?.trend?.[range] ?? [];
    if (range !== 'year' || !progress?.currentMonth) return selectedTrend;

    const currentYear = progress.currentMonth.slice(0, 4);
    return selectedTrend.filter(
      (item) => item.key >= `${currentYear}-01` && item.key <= progress.currentMonth
    );
  }, [progress?.currentMonth, progress?.trend, range]);
  const trendValue = (item: TrendDatum) => item[metric];
  const goalCategory = metric === 'challenges' ? 'moves' : metric;
  const trendTarget = TARGETS[range][goalCategory];
  const maxTrend = Math.max(1, trendTarget, ...trend.map(trendValue)) * 1.18;
  const periodTotal = trend.reduce((total, item) => total + trendValue(item), 0);
  const periodLabel = `this ${range}`;
  const trendLabel =
    metric === 'activeMinutes' ? 'active min' : metric === 'challenges' ? 'challenges' : metric;

  const captureComparison = async () => {
    if (!comparisonRef.current) throw new Error('Your comparison is still loading.');
    return captureRef(comparisonRef, { format: 'png', quality: 0.92, result: 'tmpfile' });
  };

  const uploadComparison = async (uri: string) => {
    const uploadUrl = await generateUploadUrl();
    const result = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'image/png' },
    });
    const storageId = JSON.parse(result.body || '{}').storageId;
    if (!storageId) throw new Error('Comparison upload did not finish.');
    return storageId;
  };

  const handleShare = () => {
    if (!comparisonLeft || !comparisonRight) return;
    if (
      !requireSubscription({
        redirectTo: '/(tabs)/rewards',
        source: 'progress_comparison_share',
      })
    )
      return;
    Alert.alert('Share your journey', 'Choose how you would like to share this comparison.', [
      {
        text: 'Share to Feed',
        onPress: async () => {
          setSharing(true);
          try {
            const uri = await captureComparison();
            const media = await uploadComparison(uri);
            await createPost({
              body: `My progress journey so far.`,
              media,
              mediaType: 'image',
            });
            Alert.alert(
              'Shared to the feed',
              'Your progress comparison is now in the community feed.'
            );
          } catch (error) {
            Alert.alert(
              'Could not share',
              error instanceof Error ? error.message : 'Please try again.'
            );
          } finally {
            setSharing(false);
          }
        },
      },
      {
        text: 'Save to Phone / Share',
        onPress: async () => {
          setSharing(true);
          let savedToGallery = false;
          try {
            const uri = await captureComparison();
            const permission = mediaPermission?.granted
              ? mediaPermission
              : await requestMediaPermission();
            if (!permission.granted) {
              Alert.alert('Photo access needed', 'Allow photo access to save this comparison.');
              return;
            }
            await MediaLibrary.saveToLibraryAsync(uri);
            savedToGallery = true;
            await Share.open({
              url: uri,
              type: 'image/png',
              failOnCancel: false,
              useInternalStorage: true,
            });
          } catch (error) {
            Alert.alert(
              savedToGallery ? 'Saved to your gallery' : 'Could not save comparison',
              savedToGallery
                ? 'The comparison was saved, but the share sheet did not open.'
                : error instanceof Error
                  ? error.message
                  : 'Please try again.'
            );
          } finally {
            setSharing(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View
          style={Platform.OS === 'android' ? { paddingTop: insets.top + 12 } : undefined}
          className="bg-[#F9F9F9] px-5">
          <View className="mt-3 flex-row items-end justify-between">
            <View>
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="mt-1 text-[26px] text-[#1A1918]">
                Progress
              </Text>
            </View>
            <View className="mb-1 rounded-[20px] bg-[#FFF0E8] px-3 py-1.5">
              <Text
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="text-[11px] text-[#FF4B1F]">
                {progress ? monthName(progress.currentMonth) : 'This month'}
              </Text>
            </View>
          </View>

          <View className="mt-5 min-h-[106px] flex-row items-center rounded-[24px] bg-white px-4 py-5">
            <Stat
              label="Current streak"
              value={progress?.summary.currentStreak ?? 0}
              unit="weeks"
            />
            <View className="h-14 w-px shrink-0 bg-[#EEE8E3]" />
            <Stat
              label="This month"
              value={formatNumber(progress?.summary.monthPoints ?? 0)}
              unit="points"
            />
            <View className="h-14 w-px shrink-0 bg-[#EEE8E3]" />
            <Stat
              label="Completed"
              value={progress?.summary.completedCheckIns ?? 0}
              unit="check-ins"
            />
          </View>

          <View className="mt-4 rounded-[24px] bg-white px-4 pb-4 pt-5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  style={{ fontFamily: 'Inter_700Bold' }}
                  className="mt-1 text-lg text-[#1D1B1A]">
                  Your Progress Pics
                </Text>
              </View>
            </View>
            <Text className="mt-2 font-body text-[11px] leading-4 text-[#77716D]">
              Compare your progress over time.
            </Text>

            {photos.length ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerStyle={{ gap: 7 }}>
                  {photos.map((photo, index) => (
                    <TouchableOpacity
                      key={photo._id}
                      onPress={() => setSelectedWeekIndex(index)}
                      className="rounded-[20px] px-3 py-1.5"
                      style={{
                        borderColor: index === selectedWeekIndex ? PRIMARY : '#E4DED9',
                        backgroundColor: index === selectedWeekIndex ? PRIMARY : '#FFFFFF',
                      }}>
                      <Text
                        className="text-[10px] font-semibold"
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          color: index === selectedWeekIndex ? '#FFFFFF' : '#77716D',
                        }}>
                        W{index + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {baselinePhoto?.sideUrl && currentPhoto?.sideUrl ? (
                  <View className="mt-3 flex-row rounded-[20px] bg-[#F3F0ED] p-1">
                    {(['front', 'side'] as const).map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => setView(option)}
                        className="flex-1 items-center rounded-[20px] py-1.5"
                        style={{ backgroundColor: view === option ? '#FFFFFF' : 'transparent' }}>
                        <Text
                          className="text-[10px] font-semibold"
                          style={{
                            fontFamily: 'Inter_600SemiBold',
                            color: view === option ? '#1D1B1A' : '#817A76',
                          }}>
                          {option === 'front' ? 'Front view' : 'Side view'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View
                  ref={comparisonRef}
                  collapsable={false}
                  className="mt-3 flex-row gap-x-2 bg-white">
                  {[comparisonLeft, comparisonRight].map((uri, index) => (
                    <View
                      key={`${uri}-${index}`}
                      className="h-[174px] flex-1 overflow-hidden rounded-[24px] bg-[#F0ECE8]">
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="contain"
                        />
                      ) : null}
                      <View className="absolute left-2 top-2 rounded-[20px] bg-[#382C25] px-2 py-1">
                        <Text
                          style={{ fontFamily: 'Inter_600SemiBold' }}
                          className="text-[9px] text-white">
                          Week {index === 0 ? 1 : currentWeekNumber}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className="mt-4 flex-row gap-x-3">
                <TouchableOpacity
                  onPress={openProgressPhoto}
                  className="h-[160px] flex-1 items-center justify-center rounded-[24px]    bg-[#FFF9F6]">
                  <Camera size={28} color={PRIMARY} />
                  <Text
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                    className="mt-2 text-[11px] text-[#1D1B1A]">
                    Week 1
                  </Text>
                  <Text className="mt-1 font-body text-[10px] text-[#77716D]">Add a photo</Text>
                </TouchableOpacity>
                <View className="h-[160px] flex-1 items-center justify-center rounded-[24px] bg-[#F3F0ED]">
                  <LockSimple size={22} color={PRIMARY} weight="regular" />
                  <Text className="mt-2 font-body text-[10px] text-[#817A76]">
                    Unlocks after Week 1
                  </Text>
                </View>
              </View>
            )}
            <View className="mt-4 flex-row gap-x-2">
              <TouchableOpacity
                onPress={openProgressPhoto}
                className="h-10 flex-1 flex-row items-center justify-center rounded-[20px] bg-white">
                <Camera size={15} color={PRIMARY} />
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="ml-2 text-[11px] text-[#1D1B1A]">
                  Log Week {nextWeekNumber}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!photos.length || sharing}
                onPress={handleShare}
                className="h-10 flex-1 flex-row items-center justify-center rounded-[20px] bg-white"
                style={{ opacity: photos.length ? 1 : 0.45 }}>
                {sharing ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <>
                    <ShareNetwork size={15} color={PRIMARY} />
                    <Text
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                      className="ml-2 text-[11px] text-[#1D1B1A]">
                      Share / Save
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-4 rounded-[24px] bg-white px-4 pb-4 pt-5">
            <View className="flex-row items-center justify-between" style={{ zIndex: 10 }}>
              <View>
                <Text
                  style={{ fontFamily: 'Inter_700Bold' }}
                  className="mt-1 text-lg text-[#1D1B1A]">
                  Your consistency
                </Text>
              </View>
              <TrendRangeDropdown value={range} onChange={setRange} />
            </View>
            <View className="mt-4 flex-row rounded-[24px] bg-[#F1EEEA] p-1">
              {(
                [
                  ['points', 'Points'],
                  ['steps', 'Steps'],
                  ['activeMinutes', 'Active Mins'],
                  ['challenges', 'Challenges'],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setMetric(id)}
                  className="flex-1 items-center rounded-[20px] py-2"
                  style={{ backgroundColor: metric === id ? '#FFFFFF' : 'transparent' }}>
                  <Text
                    className="text-[8px] font-semibold"
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      color: metric === id ? '#1D1B1A' : '#817A76',
                    }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-3 flex-row rounded-[24px] bg-white px-3 py-3">
              <View className="flex-1">
                <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-lg text-[#1D1B1A]">
                  {formatNumber(periodTotal)} {metric === 'points' ? 'pts' : ''}
                </Text>
                <Text className="mt-1 font-body text-[10px] text-[#817A76]">
                  {trendLabel} total {periodLabel}
                </Text>
              </View>
              <Text
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="text-[10px] text-[#16865B]">
                Live data
              </Text>
            </View>
            <View className="mb-2 mt-4 flex-row items-center justify-end gap-x-2">
              <Svg width={20} height={2}>
                <Line x1={0} y1={1} x2={20} y2={1} stroke="#999999" strokeDasharray="4 3" />
              </Svg>
              <Text className="font-body text-[10px] leading-4 text-[#817A76]">
                Goal: {formatNumber(trendTarget)}{' '}
                {metric === 'challenges' && trendTarget === 1 ? 'challenge' : trendLabel} per{' '}
                {range === 'week' ? 'day' : range === 'month' ? 'week' : 'month'}
              </Text>
            </View>
            <View className="px-2">
              <View className="h-[126px] border-b border-[#EAE4DF]">
                <View
                  pointerEvents="none"
                  className="absolute left-0 right-0"
                  style={{ bottom: `${(trendTarget / maxTrend) * 100}%` }}>
                  <Svg width="100%" height={2}>
                    <Line x1={0} y1={1} x2="100%" y2={1} stroke="#999999" strokeDasharray="4 3" />
                  </Svg>
                </View>
                <View className="h-full flex-row items-end gap-x-1">
                  {trend.map((item) => (
                    <View key={item.key} className="h-full flex-1 items-center justify-end">
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                        className="mb-1 w-full text-center text-[8px] text-[#5A5551]">
                        {formatCompactNumber(trendValue(item))}
                      </Text>
                      {trendValue(item) > 0 ? (
                        <View
                          className="w-4 rounded-t-[7px]"
                          style={{
                            height: `${(trendValue(item) / maxTrend) * 82}%`,
                            backgroundColor: getBarColor(range, goalCategory, trendValue(item)),
                          }}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
              <View className="mt-2 flex-row gap-x-1">
                {trend.map((item) => (
                  <Text
                    key={item.key}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className="flex-1 text-center font-body text-[9px] leading-4 text-[#817A76]">
                    {item.label}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-[24px] bg-white px-4 py-5">
            <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-lg text-[#1D1B1A]">
              Lifetime stats
            </Text>
            <View className="mt-4 flex-row">
              <Stat
                label="Points"
                value={progress?.lifetime ? formatNumber(progress.lifetime.points) : '—'}
              />
              <Stat
                label="Steps"
                value={progress?.lifetime ? formatNumber(progress.lifetime.steps) : '—'}
              />
            </View>
            <View className="mt-4 flex-row">
              <Stat
                label="Active minutes"
                value={progress?.lifetime ? formatNumber(progress.lifetime.activeMinutes) : '—'}
              />
              <Stat
                label="Challenges"
                value={progress?.lifetime ? formatNumber(progress.lifetime.challenges) : '—'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
