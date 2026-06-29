import { useAuthActions } from '@convex-dev/auth/react';
import { useAction } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Localization from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';

const QUARTERLY_PACKAGE_ID = '$rc_three_month';
const ANNUAL_PACKAGE_ID = '$rc_annual';
const MONTHLY_PACKAGE_ID = '$rc_monthly';

function PlanPrice({ value, featured = false }: { value?: string; featured?: boolean }) {
  return (
    <Text
      className="mt-3 w-full text-center font-extrabold"
      style={{
        color: featured ? '#FFFFFF' : '#181818',
        fontSize: featured ? 28 : 19,
        includeFontPadding: false,
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}>
      {value ?? 'Loading...'}
    </Text>
  );
}

function PerMonthText({ value, featured = false }: { value?: string | null; featured?: boolean }) {
  return (
    <Text
      className="w-full text-center font-extrabold"
      style={{
        color: featured ? '#FFFFFF' : '#FF6A2A',
        fontSize: 12,
        includeFontPadding: false,
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}>
      {value ? `${value}/mo` : 'Loading...'}
    </Text>
  );
}

function formatCurrency(value: number, currencyCode?: string) {
  const locale = Localization.getLocales()[0]?.languageTag ?? 'en-US';

  if (!currencyCode) {
    return Number(value || 0).toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function Paywall() {
  const { redirectTo, showBackToLogin } = useLocalSearchParams<{
    redirectTo?: string;
    showBackToLogin?: string;
  }>();

  const { signOut } = useAuthActions();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { packages, purchasePackage } = useRevenueCat();
  const syncToEnduranceZone = useAction(api.users.syncToEnduranceZone);

  if (__DEV__) {
    console.log('Available packages from RevenueCat:', packages);
  }

  const monthlyPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === MONTHLY_PACKAGE_ID),
    [packages]
  );

  const quarterlyPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === QUARTERLY_PACKAGE_ID),
    [packages]
  );

  const annualPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === ANNUAL_PACKAGE_ID),
    [packages]
  );

  const isPackagesLoading = packages.length === 0;

  useEffect(() => {
    if (selectedPackage) return;

    if (annualPackage) {
      setSelectedPackage(annualPackage);
      return;
    }

    if (monthlyPackage) {
      setSelectedPackage(monthlyPackage);
      return;
    }

    if (quarterlyPackage) {
      setSelectedPackage(quarterlyPackage);
    }
  }, [annualPackage, monthlyPackage, quarterlyPackage, selectedPackage]);

  const savingsPercentage = useMemo(() => {
    if (!annualPackage) return 0;

    const yearlyBaseline = monthlyPackage
      ? monthlyPackage.product.price * 12
      : quarterlyPackage
        ? quarterlyPackage.product.price * 4
        : 0;
    const annualPrice = annualPackage.product.price;

    if (!yearlyBaseline || !annualPrice) return 0;
    if (annualPrice >= yearlyBaseline) return 0;

    return Math.round(((yearlyBaseline - annualPrice) / yearlyBaseline) * 100);
  }, [annualPackage, monthlyPackage, quarterlyPackage]);

  const yearlySaving = useMemo(() => {
    if (!annualPackage) return 0;

    const yearlyBaseline = monthlyPackage
      ? monthlyPackage.product.price * 12
      : quarterlyPackage
        ? quarterlyPackage.product.price * 4
        : 0;
    const saving = yearlyBaseline - annualPackage.product.price;

    return saving > 0 ? saving : 0;
  }, [annualPackage, monthlyPackage, quarterlyPackage]);

  const yearlySavingText = useMemo(() => {
    const currencyCode =
      annualPackage?.product.currencyCode ??
      monthlyPackage?.product.currencyCode ??
      quarterlyPackage?.product.currencyCode;

    return formatCurrency(yearlySaving, currencyCode);
  }, [annualPackage, monthlyPackage, quarterlyPackage, yearlySaving]);

  const isAnnualSelected = selectedPackage?.identifier === ANNUAL_PACKAGE_ID;
  const isQuarterlySelected = selectedPackage?.identifier === QUARTERLY_PACKAGE_ID;
  const isMonthlySelected = selectedPackage?.identifier === MONTHLY_PACKAGE_ID;

  const hasTrial = Boolean(selectedPackage?.product?.introPrice);

  const isCtaDisabled =
    !selectedPackage || !purchasePackage || isLoading || isLoggingOut || isPackagesLoading;

  const paywallBullets = [
    'You want to see real progress, not just chase the scale',
    'You want a clear plan that tells you what to do each day',
    'You stick to things better when other women are doing it with you',
    "You're ready to start without overthinking it",
  ];

  const handlePurchase = async () => {
    if (!selectedPackage || !purchasePackage || isLoading || isLoggingOut) {
      return;
    }

    setIsLoading(true);

    const [purchaseError] = await CatchPromise(purchasePackage(selectedPackage));

    if (purchaseError) {
      if (__DEV__) {
        console.log('Purchase error:', purchaseError);
      }

      setIsLoading(false);
      Alert.alert('Purchase failed', 'Unable to complete the purchase. Please try again.');
      return;
    }

    const userCountry = Localization.getLocales()[0]?.regionCode || 'UK';

    await CatchPromise(
      syncToEnduranceZone({
        country: userCountry,
      })
    );

    setIsLoading(false);
    router.dismissAll();
    router.replace((redirectTo || '/(tabs)/dashboard') as any);
  };

  const handleBackToLogin = async () => {
    if (isLoggingOut || isLoading) return;

    setIsLoggingOut(true);

    try {
      try {
        await Purchases.logOut();
      } catch (error) {
        console.warn('[RevenueCat] Logout failed:', error);
      }

      await signOut();
      await setCurrentUser(null);

      router.dismissAll();
      router.replace('/(auth)/email');
    } catch (error) {
      console.error('Logout failed:', error);

      Alert.alert('Logout failed', 'Unable to return to login. Please try again.');

      setIsLoggingOut(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#FFF7F6]" showsVerticalScrollIndicator={false}>
      <View style={{ position: 'relative' }}>
        <Image
          source={require('~/assets/paywall/paywall-5.png')}
          contentFit="cover"
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: 828 / 680,
          }}
        />

        <LinearGradient
          colors={['rgba(255,247,246,0)', '#FFF7F6']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '35%',
          }}
        />
      </View>

      <View className="bg-[#FFF7F6] px-8 pb-8 pt-1">
        <Text
          className="text-center text-[21px] leading-7 text-[#121212]"
          style={{ fontFamily: 'Inter_700Bold' }}>
          You keep falling off. Let&apos;s make this the last time, sis.
        </Text>

        <View className="mt-3 flex-row justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <Icon.Star key={star} size={19} color="#FFC400" weight="fill" />
          ))}
        </View>

        <Text className="mt-2 text-center text-[13px] font-bold text-[#1A1A1A]">
          Love this app!
        </Text>

        <Text className="mx-4 mt-1 text-center text-xs leading-4 text-[#000]">
          “It&apos;s such a fun app and it gets you to move. The app is interactive and gives you
          something regardless of whatever level of fitness you are at.”
        </Text>

        <Text className="mt-1 text-right text-[11px] text-[#4A4A4A]">~ Aeaqyeman</Text>

        <View className="mx-3 mt-5">
          <Text className="text-m mb-3 text-[#000]" style={{ fontFamily: 'Inter_700Bold' }}>
            This is for you if...
          </Text>

          <View className="gap-y-3">
            {paywallBullets.map((item) => (
              <View key={item} className="flex-row gap-x-3">
                <View className="mt-0.5">
                  <Icon.CheckCircle size={18} color="#FFC4A8" weight="fill" />
                </View>

                <Text className="mt-1 flex-1 text-xs leading-4 text-[#000]">{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View
          className="mt-10 flex-row items-end justify-between"
          style={{
            columnGap: 8,
            marginHorizontal: -14,
          }}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!monthlyPackage || isLoading || isLoggingOut}
            onPress={() => {
              if (monthlyPackage) {
                setSelectedPackage(monthlyPackage);
              }
            }}
            className="flex-1 items-center justify-center rounded-[18px] px-2 pb-5 pt-6"
            style={{
              minHeight: 170,
              borderWidth: isMonthlySelected ? 1.8 : 1.2,
              borderColor: isMonthlySelected ? '#FF6A2A' : '#E8E1DF',
              backgroundColor: '#FFFFFF',
              opacity: monthlyPackage ? 1 : 0.55,
              overflow: 'visible',
            }}>
            {isMonthlySelected && (
              <View
                style={{
                  position: 'absolute',
                  top: -10,
                  right: 14,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: '#FF5C1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}>
                <Icon.Check size={17} color="#FFFFFF" weight="bold" />
              </View>
            )}

            <Text
              className="w-full text-center text-[14px] font-extrabold text-[#9E9E9E]"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              MONTHLY
            </Text>

            <PlanPrice value={monthlyPackage?.product.priceString} />

            <Text className="mt-3 text-center text-[12px] font-semibold text-[#A2A2A2]">
              per month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!annualPackage || isLoading || isLoggingOut}
            onPress={() => {
              if (annualPackage) {
                setSelectedPackage(annualPackage);
              }
            }}
            className="items-center justify-center rounded-[20px] px-2 pb-5 pt-8"
            style={{
              flex: 1.18,
              minHeight: 176,
              position: 'relative',
              backgroundColor: '#FF6A2A',
              opacity: annualPackage ? 1 : 0.55,
              overflow: 'visible',
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#FF6A2A',
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.24,
                    shadowRadius: 10,
                  }
                : {
                    elevation: 5,
                  }),
            }}>
            <View
              style={{
                position: 'absolute',
                top: -18,
                alignSelf: 'center',
                backgroundColor: '#151515',
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}>
              <Text className="text-[10px] font-extrabold text-white" numberOfLines={1}>
                BEST VALUE
              </Text>
            </View>

            {isAnnualSelected && (
              <View
                style={{
                  position: 'absolute',
                  top: 13,
                  right: 12,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon.Check size={17} color="#FFFFFF" weight="bold" />
              </View>
            )}

            <Text className="w-full text-center text-[18px] font-extrabold text-white">YEARLY</Text>

            <PlanPrice value={annualPackage?.product.priceString} featured />

            <Text className="mt-1 text-center text-[15px] font-semibold text-white">per year</Text>

            <View
              className="mt-4 w-full items-center rounded-[5px] px-2 py-2"
              style={{ backgroundColor: 'rgba(218,76,28,0.65)' }}>
              <PerMonthText value={annualPackage?.product.pricePerMonthString} featured />

              {yearlySaving > 0 && (
                <Text
                  className="mt-1 w-full text-center text-[12px] font-extrabold text-white"
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}>
                  Save {savingsPercentage}% ({yearlySavingText})
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!quarterlyPackage || isLoading || isLoggingOut}
            onPress={() => {
              if (quarterlyPackage) {
                setSelectedPackage(quarterlyPackage);
              }
            }}
            className="flex-1 items-center justify-center rounded-[18px] px-2 pb-5 pt-6"
            style={{
              minHeight: 170,
              borderWidth: isQuarterlySelected ? 1.8 : 1.2,
              borderColor: isQuarterlySelected ? '#FF6A2A' : '#E8E1DF',
              backgroundColor: '#FFFFFF',
              opacity: quarterlyPackage ? 1 : 0.55,
              overflow: 'visible',
            }}>
            {isQuarterlySelected && (
              <View
                style={{
                  position: 'absolute',
                  top: -10,
                  right: 14,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: '#FF5C1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}>
                <Icon.Check size={17} color="#FFFFFF" weight="bold" />
              </View>
            )}

            <Text
              className="w-full text-center text-[14px] font-extrabold text-[#9E9E9E]"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.64}>
              QUARTERLY
            </Text>

            <PlanPrice value={quarterlyPackage?.product.priceString} />

            <Text
              className="mt-3 text-center text-[12px] font-semibold leading-4 text-[#A2A2A2]"
              numberOfLines={2}>
              every 3 months
            </Text>

            <View className="mt-2 w-full px-1">
              <PerMonthText value={quarterlyPackage?.product.pricePerMonthString} />
            </View>
          </TouchableOpacity>
        </View>

        <Text className="mt-3 text-center text-[11px] text-[#999999]">
          Start today. Cancel anytime.
        </Text>

        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isCtaDisabled}
          activeOpacity={0.9}
          className="mt-4"
          style={{
            borderRadius: 999,
            opacity: isCtaDisabled ? 0.6 : 1,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#000000',
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                }
              : {
                  elevation: 4,
                }),
          }}>
          <View
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {isLoading ? (
              <View className="flex-row items-center justify-center">
                <Text className="mr-2 text-lg font-bold text-white">Processing...</Text>
                <ActivityIndicator size={20} color="#FFFFFF" />
              </View>
            ) : (
              <Text className="text-lg font-bold text-white">
                {isPackagesLoading
                  ? 'Loading plans...'
                  : hasTrial
                    ? 'Try Free For 7 Days'
                    : 'Continue'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {showBackToLogin === 'true' && (
          <TouchableOpacity
            onPress={handleBackToLogin}
            disabled={isLoggingOut || isLoading}
            activeOpacity={0.7}
            className="mt-4 items-center py-3">
            {isLoggingOut ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#FF5C1A" />

                <Text className="ml-2 text-sm font-semibold text-[#FF5C1A]">Signing out...</Text>
              </View>
            ) : (
              <Text className="text-sm font-semibold text-[#FF5C1A]">Back to login</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
