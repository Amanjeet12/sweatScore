import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Camera,
  LockSimple,
  ShareNetwork,
  Star,
  Footprints,
  Clock,
  Trophy,
} from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Share from 'react-native-share';
import Svg, { Line } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { BackButton, goBackOrReplace } from '~/components/core/BackButton';
import { CheckInHeader, checkInStyles } from '~/components/core/design/CheckInChrome';
import { ProgressTabs } from '~/components/core/design/ProgressTabs';
import {
  prototypeColors as colors,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import TrendRangeDropdown, { ProgressDropdown } from '~/components/core/track/TrendRangeDropdown';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { TARGETS } from '~/shared/activityGoals';
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

const PRIMARY = colors.icon;
const PHOTO_ORANGE = '#E8541E';

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

function formatWeekStart(weekStart: string) {
  const [year, month, day] = weekStart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function Stat({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: typeof Star;
}) {
  if (Icon)
    return (
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff3ea]">
          <Icon size={22} color={colors.icon} weight="regular" />
        </View>
        <View className="min-w-0 flex-1">
          <Text style={type.smallCaption}>{label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={type.cardTitle}>
            {value}
          </Text>
        </View>
      </View>
    );
  return (
    <View className="min-w-0 flex-1 px-2">
      <Text numberOfLines={1} adjustsFontSizeToFit style={type.smallCaption}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className="my-1" style={type.sectionHeading}>
        {value}
      </Text>
      {unit ? (
        <Text numberOfLines={1} adjustsFontSizeToFit style={type.smallCaption}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export default function TabTrack() {
  const { openShare } = useLocalSearchParams<{ openShare?: string }>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { isPro, requireSubscription } = useSubscriptionGuard();
  const progress = useQuery(
    api.progressPhotos.getDashboard,
    currentUser?._id && isPro ? {} : 'skip'
  ) as DashboardData | undefined;
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const createPost = useMutation(api.posts.createPost);
  const comparisonRef = useRef<View>(null);
  const autoShareOpened = useRef(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [view, setView] = useState<'front' | 'side'>('front');
  const [metric, setMetric] = useState<TrendMetric>('points');
  const [range, setRange] = useState<TrendRange>('year');
  const [sharing, setSharing] = useState(false);
  const [shareLoadedUrls, setShareLoadedUrls] = useState<string[]>([]);
  const [shareLogoLoaded, setShareLogoLoaded] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

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
  const currentWeekIndex = selectedWeekIndex ?? photos.length - 1;
  const currentPhoto = photos[currentWeekIndex] ?? photos[photos.length - 1];
  const frontBaseline = photos[0];
  const sideBaseline = photos.find((photo) => photo.sideUrl);
  const showSide = view === 'side';
  const baselinePhoto = showSide ? sideBaseline : frontBaseline;
  const baselineWeekNumber = baselinePhoto ? photos.indexOf(baselinePhoto) + 1 : 1;
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
    if (
      !comparisonLeft ||
      !comparisonRight ||
      !shareLoadedUrls.includes(comparisonLeft) ||
      !shareLoadedUrls.includes(comparisonRight) ||
      !shareLogoLoaded
    ) {
      throw new Error('Your comparison is still loading. Please try again in a moment.');
    }
    return captureRef(comparisonRef, {
      format: 'png',
      quality: 0.92,
      result: 'tmpfile',
      useRenderInContext: Platform.OS === 'ios',
    });
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

  useEffect(() => {
    if (openShare !== '1') {
      autoShareOpened.current = false;
      return;
    }
    if (
      autoShareOpened.current ||
      !comparisonLeft ||
      !comparisonRight ||
      !shareLoadedUrls.includes(comparisonLeft) ||
      !shareLoadedUrls.includes(comparisonRight) ||
      !shareLogoLoaded
    )
      return;
    autoShareOpened.current = true;
    router.setParams({ openShare: undefined });
    handleShare();
  }, [openShare, comparisonLeft, comparisonRight, shareLoadedUrls, shareLogoLoaded]);

  if (!isPro)
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9] px-5 pt-8">
        <Stack.Screen options={{ headerShown: false }} />
        <CheckInHeader title="Progress" onBack={() => goBackOrReplace()} />
        <View className="mt-6 rounded-2xl bg-white p-5">
          <Text className="font-heading text-lg font-semibold">Progress access unavailable</Text>
          <Text className="mt-2 text-sm text-[#77716D]">
            Your saved photos remain private. Verified Premium access is required to compare, share
            or save them.
          </Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      {/* Capture-only canvas. Keep the on-page preview compact while exporting a square comparison. */}
      <View
        ref={comparisonRef}
        collapsable={false}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          width: 360,
          height: 360,
          flexDirection: 'row',
          backgroundColor: '#1D1B1A',
        }}>
        {[comparisonLeft, comparisonRight].map((uri, index) => (
          <View
            key={`share-${uri}-${index}`}
            className="h-full flex-1 overflow-hidden bg-[#282522]">
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                onLoad={() =>
                  setShareLoadedUrls((loaded) => (loaded.includes(uri) ? loaded : [...loaded, uri]))
                }
              />
            ) : null}
            <View
              className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-1.5"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)' }}>
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="text-[10px] uppercase text-[#FF7048]">
                Week {index === 0 ? baselineWeekNumber : currentWeekNumber}
              </Text>
              <Text className="mt-0.5 font-body text-[9px] text-white">
                Week of{' '}
                {formatWeekStart(
                  index === 0 ? (baselinePhoto?.weekStart ?? '') : (currentPhoto?.weekStart ?? '')
                )}
              </Text>
            </View>
          </View>
        ))}
        {/* The supplied square PNG has transparent padding; these offsets align its artwork. */}
        <Image
          source={require('~/assets/logos/progress-share.png')}
          style={{ position: 'absolute', top: -31, left: 5, width: 105, height: 105 }}
          contentFit="contain"
          onLoad={() => setShareLogoLoaded(true)}
        />
      </View>
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-[#F9F9F9] px-5">
          <View className="mt-3 flex-row items-center gap-3">
            <BackButton
              accessibilityLabel="Go back"
              iconColor="#2a2a2a"
              iconSize={22}
              style={[
                checkInStyles.back,
                { minWidth: 44, minHeight: 44, backgroundColor: 'transparent' },
              ]}
            />
            <Text style={[type.todayTitle, { flex: 1 }]}>Progress</Text>
            <Text style={[type.compactAction, { color: colors.muted }]}>
              {progress ? monthName(progress.currentMonth) : 'This month'}
            </Text>
          </View>

          <View className="mt-5 min-h-[106px] flex-row items-center rounded-[24px] bg-white px-6 py-5">
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

          <View className="mt-4 rounded-[24px] bg-white px-6 pb-5 pt-5">
            <View className="flex-row items-center justify-between gap-2">
              <Text style={[type.sectionHeading, { flex: 1 }]}>Your progress</Text>
              {photos.length ? (
                <ProgressDropdown
                  value={currentWeekIndex}
                  onChange={setSelectedWeekIndex}
                  accessibilityLabel="Progress photo week"
                  options={photos.map((photo, index) => [index, `Week ${index + 1}`] as const)}
                />
              ) : null}
            </View>
            <View
              className="mb-5 mt-4 flex-row gap-7"
              accessibilityRole="tablist"
              accessibilityLabel="Progress photo view">
              {(['front', 'side'] as const).map((photoView) => (
                <TouchableOpacity
                  key={photoView}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === photoView }}
                  onPress={() => setView(photoView)}
                  className="min-h-11 justify-center border-b-2"
                  style={{ borderColor: view === photoView ? PHOTO_ORANGE : 'transparent' }}>
                  <Text
                    style={[
                      type.photoTab,
                      {
                        color: view === photoView ? PHOTO_ORANGE : '#6F6F6F',
                        fontFamily: view === photoView ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}>
                    {photoView === 'front' ? 'Front view' : 'Side view'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row justify-between gap-3">
              {[baselinePhoto, currentPhoto].map((photo, index) => {
                const uri = index === 0 ? comparisonLeft : comparisonRight;
                const available = index === 0 || photos.length > 0;
                return (
                  <TouchableOpacity
                    key={index}
                    disabled={Boolean(photo) || index !== 0}
                    onPress={openProgressPhoto}
                    accessibilityRole={!photo && index === 0 ? 'button' : undefined}
                    accessibilityLabel={!photo && index === 0 ? 'Week 1, add a photo' : undefined}
                    activeOpacity={0.88}
                    className="flex-1 overflow-hidden rounded-[22px]"
                    style={{
                      aspectRatio: 0.71,
                      backgroundColor: index === 0 ? '#FFF9F6' : '#F3F0ED',
                    }}>
                    {uri ? (
                      <Image
                        source={{ uri }}
                        contentFit="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center p-3">
                        {available ? (
                          <Camera color={PHOTO_ORANGE} size={30} />
                        ) : (
                          <LockSimple color={PHOTO_ORANGE} size={27} />
                        )}
                        {available ? (
                          <>
                            {index !== 0 ? (
                              <Text
                                style={[type.compactCardTitle, { textAlign: 'center' }]}
                                className="mt-3">
                                Week {nextWeekNumber}
                              </Text>
                            ) : null}
                            <Text
                              style={[type.smallCaption, { color: '#77716D', textAlign: 'center' }]}
                              className="mt-1">
                              {photo ? 'Photo unavailable' : 'Add a photo'}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={[type.smallCaption, { color: '#817A76', textAlign: 'center' }]}
                            className="mt-3">
                            Unlocks after Week 1
                          </Text>
                        )}
                      </View>
                    )}
                    {photo ? (
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.55)']}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          paddingHorizontal: 14,
                          paddingBottom: 14,
                          paddingTop: 40,
                        }}>
                        <Text style={[type.compactCardTitle, { color: '#fff' }]}>
                          Week {index === 0 ? baselineWeekNumber : currentWeekNumber}
                        </Text>
                        <Text style={[type.smallCaption, { color: 'rgba(255,255,255,0.8)' }]}>
                          {formatWeekStart(photo.weekStart)}
                        </Text>
                      </LinearGradient>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="mt-4 flex-row gap-x-2">
              <TouchableOpacity
                onPress={openProgressPhoto}
                className="min-h-11 flex-1 flex-row items-center justify-center py-2">
                <Camera size={20} color={PRIMARY} />
                <Text style={[type.compactAction, { flexShrink: 1 }]} className="ml-2">
                  Log Week {nextWeekNumber}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!photos.length || sharing}
                onPress={handleShare}
                className="min-h-11 flex-1 flex-row items-center justify-center py-2"
                style={{ opacity: photos.length && !sharing ? 1 : 0.45 }}>
                {sharing ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <>
                    <ShareNetwork size={20} color={PRIMARY} />
                    <Text style={[type.compactAction, { flexShrink: 1 }]} className="ml-2">
                      Share / Save
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-4 rounded-[24px] bg-white px-6 pb-5 pt-5">
            <View className="flex-row items-center justify-between" style={{ zIndex: 10 }}>
              <View>
                <Text style={type.sectionHeading} className="mt-1">
                  Your consistency
                </Text>
              </View>
              <TrendRangeDropdown value={range} onChange={setRange} />
            </View>
            <View className="mt-4">
              <ProgressTabs
                label="Consistency metric"
                value={metric}
                options={
                  [
                    ['points', 'Points'],
                    ['steps', 'Steps'],
                    ['activeMinutes', 'Active mins'],
                    ['challenges', 'Challenges'],
                  ] as const
                }
                onChange={setMetric}
              />
            </View>
            <View className="mt-4 flex-row bg-white py-3">
              <View className="flex-1">
                <Text style={[type.todayTitle, { fontSize: 26, lineHeight: 32 }]}>
                  {formatNumber(periodTotal)}
                </Text>
                <Text className="mt-1" style={type.caption}>
                  {trendLabel} total {periodLabel}
                </Text>
              </View>
              <Text style={[type.smallCaption, { color: '#16865B' }]}>Live data</Text>
            </View>
            <View className="mb-2 mt-4 flex-row items-center justify-end gap-x-2">
              <Svg width={20} height={2}>
                <Line x1={0} y1={1} x2={20} y2={1} stroke="#999999" strokeDasharray="4 3" />
              </Svg>
              <Text style={[type.smallCaption, { flexShrink: 1 }]}>
                Goal: {formatNumber(trendTarget)}{' '}
                {metric === 'challenges' && trendTarget === 1 ? 'challenge' : trendLabel} per{' '}
                {range === 'week' ? 'day' : range === 'month' ? 'week' : 'month'}
              </Text>
            </View>
            <View className="px-2">
              <View className="h-[150px] border-b border-[#EAE4DF]">
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
                      {trendValue(item) > 0 ? (
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{ fontFamily: 'Inter_600SemiBold' }}
                          className="mb-1 w-full text-center text-[10px] text-[#8a8a8a]">
                          {formatCompactNumber(trendValue(item))}
                        </Text>
                      ) : null}
                      {trendValue(item) > 0 ? (
                        <View
                          className="w-4 rounded-t-[7px]"
                          style={{
                            height: `${(trendValue(item) / maxTrend) * 100}%`,
                            backgroundColor: '#d9d9d9',
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

          <View className="mt-4 rounded-[24px] bg-white px-6 py-5">
            <Text style={type.sectionHeading}>Lifetime stats</Text>
            <View className="mt-4 flex-row gap-3">
              <Stat
                icon={Star}
                label="Points"
                value={progress?.lifetime ? formatNumber(progress.lifetime.points) : '—'}
              />
              <Stat
                icon={Footprints}
                label="Steps"
                value={progress?.lifetime ? formatNumber(progress.lifetime.steps) : '—'}
              />
            </View>
            <View className="mt-4 flex-row gap-3">
              <Stat
                icon={Clock}
                label="Active mins"
                value={progress?.lifetime ? formatNumber(progress.lifetime.activeMinutes) : '—'}
              />
              <Stat
                icon={Trophy}
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
