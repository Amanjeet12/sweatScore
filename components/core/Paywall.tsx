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

const ANNUAL_PACKAGE_ID = '$rc_annual';
const MONTHLY_PACKAGE_ID = '$rc_monthly';

type PlanCardProps = {
  title: string;
  price?: string;
  billingSuffix: string;
  selected: boolean;
  disabled: boolean;
  offerLabel?: string;
  onPress: () => void;
};

function PlanCard({
  title,
  price,
  billingSuffix,
  selected,
  disabled,
  offerLabel,
  onPress,
}: PlanCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{
        selected,
        disabled,
      }}
      accessibilityLabel={`${title} subscription plan`}
      className="flex-1"
      style={{
        minHeight: 96,
        position: 'relative',
        borderRadius: 18,
        borderWidth: selected ? 1.8 : 1.2,
        borderColor: selected ? '#FF6A2A' : '#D8D5D3',
        backgroundColor: selected ? '#FFF0EA' : '#FFFFFF',
        paddingHorizontal: 17,
        paddingBottom: 18,
        paddingTop: 14,
        opacity: disabled ? 0.55 : 1,
        overflow: 'visible',
      }}>
      <View className="flex-row items-start justify-between">
        <Text
          className="flex-1 pr-2 text-[17px] font-extrabold text-[#202020]"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}>
          {title}
        </Text>

        <View
          style={{
            width: 26,
            height: 26,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 13,
            borderWidth: selected ? 0 : 1.4,
            borderColor: '#9F9F9F',
            backgroundColor: selected ? '#FF5C1A' : '#FFFFFF',
          }}>
          {selected ? <Icon.Check size={17} color="#FFFFFF" weight="bold" /> : null}
        </View>
      </View>

      <Text
        className="mt-1 w-full text-[16px] text-[#262626]"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}>
        {price ? `${price}${billingSuffix}` : 'Loading...'}
      </Text>

      {offerLabel ? (
        <View
          style={{
            position: 'absolute',
            bottom: -15,
            alignSelf: 'center',
            borderRadius: 999,
            backgroundColor: '#FF5C1A',
            paddingHorizontal: 12,
            paddingVertical: 5,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#FF5C1A',
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                  shadowOpacity: 0.18,
                  shadowRadius: 5,
                }
              : {
                  elevation: 3,
                }),
          }}>
          <Text
            className="text-[12px] font-bold text-white"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {offerLabel}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
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

  const annualPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === ANNUAL_PACKAGE_ID),
    [packages]
  );

  /*
   * The paywall only requires monthly and annual plans.
   * Other RevenueCat packages are ignored.
   */
  const isPackagesLoading = !monthlyPackage && !annualPackage;

  /*
   * Select annual by default because it is the
   * recommended plan in the reference design.
   */
  useEffect(() => {
    if (selectedPackage) {
      return;
    }

    if (annualPackage) {
      setSelectedPackage(annualPackage);
      return;
    }

    if (monthlyPackage) {
      setSelectedPackage(monthlyPackage);
    }
  }, [annualPackage, monthlyPackage, selectedPackage]);

  const isAnnualSelected = selectedPackage?.identifier === ANNUAL_PACKAGE_ID;
  const isMonthlySelected = selectedPackage?.identifier === MONTHLY_PACKAGE_ID;

  /*
   * Calculates the approximate number of free
   * months compared with paying monthly for a year.
   */
  const annualFreeMonths = useMemo(() => {
    if (!monthlyPackage || !annualPackage) {
      return 0;
    }

    const monthlyPrice = monthlyPackage.product.price;
    const annualPrice = annualPackage.product.price;

    if (monthlyPrice <= 0 || annualPrice <= 0) {
      return 0;
    }

    const annualMonthlyEquivalent = annualPrice / monthlyPrice;
    const savedMonths = 12 - annualMonthlyEquivalent;

    return Math.max(0, Math.round(savedMonths));
  }, [annualPackage, monthlyPackage]);

  const annualOfferLabel =
    annualFreeMonths > 0
      ? `${annualFreeMonths} ${annualFreeMonths === 1 ? 'month' : 'months'} free`
      : 'Best value';

  const hasTrial = Boolean(selectedPackage?.product?.introPrice);

  const isCtaDisabled =
    !selectedPackage || !purchasePackage || isLoading || isLoggingOut || isPackagesLoading;

  const paywallBullets = [
    "You've done the diets and plans, but nothing else ever sticks",
    'You stay consistent when other women are doing it with you',
    'You want to make progress and keep it without feeling confused',
    "You want clear weekly targets and a daily check-in, not a strict program you'll quit",
    'You want to enjoy the process',
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
    if (isLoggingOut || isLoading) {
      return;
    }

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
    <ScrollView
      className="flex-1 bg-[#FFF7F6]"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: 20,
      }}>
      <View
        style={{
          position: 'relative',
        }}>
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
            right: 0,
            bottom: 0,
            left: 0,
            height: '35%',
          }}
        />
      </View>

      <View className="bg-[#FFF7F6] px-8 pb-8 pt-1">
        <Text
          className="text-center text-[21px] leading-7 text-[#121212]"
          style={{
            fontFamily: 'Inter_700Bold',
          }}>
          You keep falling off. Let&apos;s make this the last time, sis.
        </Text>

        <Text className="mx-1 mt-4 text-center text-[15px] leading-5 text-[#252525]">
          Losing weight was never the hard part. Keeping it going is. SweatScore is built for the
          part everyone else abandons you at.
        </Text>

        <View className="mx-1 mt-7">
          <Text
            className="mb-4 text-[17px] text-[#171717]"
            style={{
              fontFamily: 'Inter_700Bold',
            }}>
            This is for you if...
          </Text>

          <View className="gap-y-3">
            {paywallBullets.map((item) => (
              <View key={item} className="flex-row items-start">
                <View className="mr-3 mt-0.5">
                  <Icon.CheckCircle size={21} color="#FFC4A8" weight="fill" />
                </View>

                <Text className="flex-1 text-[14px] leading-[18px] text-[#252525]">{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Monthly and Annual plans */}
        <View
          className="mt-9 flex-row items-stretch"
          style={{
            columnGap: 14,
            marginBottom: 18,
          }}>
          <PlanCard
            title="Monthly"
            price={monthlyPackage?.product.priceString}
            billingSuffix="/mo"
            selected={isMonthlySelected}
            disabled={!monthlyPackage || isLoading || isLoggingOut}
            onPress={() => {
              if (monthlyPackage) {
                setSelectedPackage(monthlyPackage);
              }
            }}
          />

          <PlanCard
            title="Annual"
            price={annualPackage?.product.priceString}
            billingSuffix="/yr"
            selected={isAnnualSelected}
            disabled={!annualPackage || isLoading || isLoggingOut}
            offerLabel={annualOfferLabel}
            onPress={() => {
              if (annualPackage) {
                setSelectedPackage(annualPackage);
              }
            }}
          />
        </View>

        <Text className="mt-3 text-center text-[12px] text-[#999999]">
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
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: '#FF5C1A',
              paddingVertical: 15,
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

        {showBackToLogin === 'true' ? (
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
        ) : null}
      </View>
    </ScrollView>
  );
}
