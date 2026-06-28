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

    if (quarterlyPackage) {
      setSelectedPackage(quarterlyPackage);
    }
  }, [annualPackage, quarterlyPackage, selectedPackage]);

  const savingsPercentage = useMemo(() => {
    if (!quarterlyPackage || !annualPackage) return 0;

    const quarterlyPerYear = quarterlyPackage.product.price * 4;
    const annualPrice = annualPackage.product.price;

    if (!quarterlyPerYear || !annualPrice) return 0;
    if (annualPrice >= quarterlyPerYear) return 0;

    return Math.round(((quarterlyPerYear - annualPrice) / quarterlyPerYear) * 100);
  }, [quarterlyPackage, annualPackage]);

  const yearlySaving = useMemo(() => {
    if (!quarterlyPackage || !annualPackage) return 0;

    const saving = quarterlyPackage.product.price * 4 - annualPackage.product.price;

    return saving > 0 ? saving : 0;
  }, [quarterlyPackage, annualPackage]);

  const yearlySavingText = useMemo(() => {
    const currencyCode =
      annualPackage?.product.currencyCode ?? quarterlyPackage?.product.currencyCode;

    return formatCurrency(yearlySaving, currencyCode);
  }, [annualPackage, quarterlyPackage, yearlySaving]);

  const isAnnualSelected = selectedPackage?.identifier === ANNUAL_PACKAGE_ID;
  const isQuarterlySelected = selectedPackage?.identifier === QUARTERLY_PACKAGE_ID;

  const hasTrial = Boolean(selectedPackage?.product?.introPrice);
  const ctaText = hasTrial ? 'Try Free for 7 Days' : 'Continue';

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
          <Text className="mb-3 text-m text-[#000]" style={{ fontFamily: 'Inter_700Bold' }}>
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

        <View className="mt-8 gap-y-3">
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!annualPackage || isLoading || isLoggingOut}
            onPress={() => {
              if (annualPackage) {
                setSelectedPackage(annualPackage);
              }
            }}
            className="rounded-2xl px-4 py-4"
            style={{
              position: 'relative',
              borderWidth: 1.4,
              borderColor: isAnnualSelected ? '#FF5C1A' : '#E6E6E6',
              backgroundColor: isAnnualSelected ? '#FFF3EC' : '#FFFFFF',
              opacity: annualPackage ? 1 : 0.55,
            }}>
            {annualPackage && yearlySaving > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -13,
                  alignSelf: 'center',
                  backgroundColor: '#FF5C1A',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                }}>
                <Text className="text-[11px] font-bold text-white">
                  Save {savingsPercentage}% · {yearlySavingText}/year
                </Text>
              </View>
            )}

            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold text-[#1A1A1A]">Annual</Text>

                <Text className="mt-1 text-[13px] text-[#555555]">
                  {annualPackage?.product.priceString ?? 'Loading...'}/year
                </Text>

                <Text className="mt-0.5 text-[12px] text-[#777777]">
                  {annualPackage?.product.pricePerMonthString
                    ? `${annualPackage.product.pricePerMonthString}/month`
                    : 'Best yearly value'}
                </Text>
              </View>

              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{
                  borderWidth: 1,
                  borderColor: isAnnualSelected ? '#FF5C1A' : '#BDBDBD',
                  backgroundColor: isAnnualSelected ? '#FF5C1A' : '#FFFFFF',
                }}>
                {isAnnualSelected && <Icon.Check size={14} color="#FFFFFF" weight="bold" />}
              </View>
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
            className="rounded-2xl px-4 py-4"
            style={{
              borderWidth: 1.4,
              borderColor: isQuarterlySelected ? '#FF5C1A' : '#E6E6E6',
              backgroundColor: isQuarterlySelected ? '#FFF3EC' : '#FFFFFF',
              opacity: quarterlyPackage ? 1 : 0.55,
            }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold text-[#1A1A1A]">Quarterly</Text>

                <Text className="mt-1 text-[13px] text-[#555555]">
                  {quarterlyPackage?.product.priceString ?? 'Loading...'}/quarter
                </Text>

                <Text className="mt-0.5 text-[12px] text-[#777777]">
                  {quarterlyPackage?.product.pricePerMonthString
                    ? `${quarterlyPackage.product.pricePerMonthString}/month`
                    : 'Every 3 months'}
                </Text>
              </View>

              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{
                  borderWidth: 1,
                  borderColor: isQuarterlySelected ? '#FF5C1A' : '#BDBDBD',
                  backgroundColor: isQuarterlySelected ? '#FF5C1A' : '#FFFFFF',
                }}>
                {isQuarterlySelected && <Icon.Check size={14} color="#FFFFFF" weight="bold" />}
              </View>
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
                {isPackagesLoading ? 'Loading plans...' : ctaText}
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

                <Text className="ml-2 text-sm font-semibold text-[#FF5C1A]">
                  Signing out...
                </Text>
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