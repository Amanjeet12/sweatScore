import { useAuthActions } from '@convex-dev/auth/react';
import { useAction } from 'convex/react';
import { Image } from 'expo-image';
import * as Localization from 'expo-localization';
import { Link, router, useLocalSearchParams } from 'expo-router';
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

import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
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
  detail: string;
  selected: boolean;
  disabled: boolean;
  offerLabel?: string;
  onPress: () => void;
};

function formatCurrency(value: number, currencyCode?: string) {
  const locale = Localization.getLocales()[0]?.languageTag ?? 'en-US';

  if (!currencyCode) {
    return value.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PlanCard({
  title,
  price,
  billingSuffix,
  detail,
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
        position: 'relative',
        minHeight: 132,
        borderRadius: 22,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? '#FF5C1A' : '#D7D7D7',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingTop: 28,
        paddingBottom: 16,
        opacity: disabled ? 0.55 : 1,
        overflow: 'visible',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text className="font-heading text-xl font-bold text-[#1A1A1A]">{title}</Text>

      <Text
        className="mt-2 w-full text-center font-body text-lg text-[#4F4F4F]"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}>
        {price ? `${price}${billingSuffix}` : 'Loading...'}
      </Text>

      <Text
        className="mt-2 w-full text-center font-body text-sm text-[#737373]"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {detail}
      </Text>

      {offerLabel ? (
        <View
          style={{
            position: 'absolute',
            top: -16,
            alignSelf: 'center',
            borderRadius: 999,
            backgroundColor: '#FF5C1A',
            paddingHorizontal: 15,
            paddingVertical: 6,
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
            className="text-[12px] font-extrabold uppercase text-white"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}>
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
  const [isRestoring, setIsRestoring] = useState(false);

  const { packages, purchasePackage, restorePermissions } = useRevenueCat();

  const syncToEnduranceZone = useAction(api.users.syncToEnduranceZone);

  if (__DEV__) {
    console.log('Available packages from RevenueCat:', JSON.stringify(packages, null, 2));
  }

  const monthlyPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === MONTHLY_PACKAGE_ID),
    [packages]
  );

  const annualPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === ANNUAL_PACKAGE_ID),
    [packages]
  );

  const isPackagesLoading = !monthlyPackage && !annualPackage;

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
   * Compare 12 monthly payments with
   * the price of one annual subscription.
   */
  const annualSaving = useMemo(() => {
    if (!monthlyPackage || !annualPackage) {
      return 0;
    }

    const monthlyPrice = monthlyPackage.product.price;
    const annualPrice = annualPackage.product.price;

    if (monthlyPrice <= 0 || annualPrice <= 0) {
      return 0;
    }

    const yearlyMonthlyCost = monthlyPrice * 12;
    const saving = yearlyMonthlyCost - annualPrice;

    return Math.max(0, saving);
  }, [annualPackage, monthlyPackage]);

  const annualSavingText = useMemo(() => {
    if (annualSaving <= 0) {
      return null;
    }

    const currencyCode =
      annualPackage?.product.currencyCode ?? monthlyPackage?.product.currencyCode;

    return formatCurrency(annualSaving, currencyCode);
  }, [annualPackage, annualSaving, monthlyPackage]);

  const annualOfferLabel = annualSavingText ? `Save ${annualSavingText}` : 'Best value';

  const annualMonthlyPrice = useMemo(() => {
    if (!annualPackage?.product.price) {
      return null;
    }

    const monthlyEquivalent = Math.floor((annualPackage.product.price / 12) * 100) / 100;

    return formatCurrency(monthlyEquivalent, annualPackage.product.currencyCode);
  }, [annualPackage]);

  const isCtaDisabled =
    !selectedPackage ||
    !purchasePackage ||
    isLoading ||
    isLoggingOut ||
    isRestoring ||
    isPackagesLoading;

  const paywallBullets = [
    'Jump rope and sculpt challenges',
    'A simple plan to stay consistent',
    'Daily checklist to maintain habits',
    'Auto-tracked steps and workouts',
    'A community to keep you motivated',
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

      setCurrentUser(null);

      router.dismissAll();
      router.replace('/(auth)/email');
    } catch (error) {
      console.error('Logout failed:', error);

      Alert.alert('Logout failed', 'Unable to return to login. Please try again.');

      setIsLoggingOut(false);
    }
  };

  const handleRestore = async () => {
    if (!restorePermissions || isRestoring || isLoading || isLoggingOut) {
      return;
    }

    setIsRestoring(true);

    try {
      const customerInfo = await restorePermissions();
      const hasPremium = customerInfo.entitlements.active.Premium !== undefined;

      if (!hasPremium) {
        Alert.alert('No subscription found', 'We could not find an active Premium subscription.');
        return;
      }

      const userCountry = Localization.getLocales()[0]?.regionCode || 'UK';
      await CatchPromise(syncToEnduranceZone({ country: userCountry }));

      router.dismissAll();
      router.replace((redirectTo || '/(tabs)/dashboard') as any);
    } catch (error) {
      if (__DEV__) {
        console.log('Restore error:', error);
      }

      Alert.alert('Restore failed', 'Unable to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 18,
      }}>
      <View className="items-center pt-5">
        <Image
          accessibilityLabel="SweatScore"
          source={require('~/assets/paywall/logo.png')}
          contentFit="contain"
          style={{ width: 230, height: 45 }}
        />
      </View>

      <View className="mt-9 items-center">
        <Text className="text-center font-heading text-[32px] font-bold leading-10 text-[#111111]">
          Choose your plan
        </Text>
        <Text className="mt-2 max-w-[330px] text-center font-body text-lg font-semibold leading-7 text-[#5F6270]">
          Everything you need to stay consistent and see results
        </Text>
      </View>

      <View className="mt-9 gap-y-4 px-3">
        {paywallBullets.map((item) => (
          <View key={item} className="flex-row items-center">
            <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-primary-500">
              <Icon.Check size={18} color="#FFFFFF" weight="bold" />
            </View>
            <Text className="flex-1 font-body text-base leading-6 text-[#1A1A1A]">{item}</Text>
          </View>
        ))}
      </View>

      <View className="mt-10 flex-row items-stretch" style={{ columnGap: 14, marginBottom: 10 }}>
        <PlanCard
          title="Monthly"
          price={monthlyPackage?.product.priceString}
          billingSuffix="/mo"
          detail="Cancel anytime"
          selected={isMonthlySelected}
          disabled={!monthlyPackage || isLoading || isLoggingOut || isRestoring}
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
          detail={annualMonthlyPrice ? `Just ${annualMonthlyPrice}/mo.` : 'Best monthly value'}
          selected={isAnnualSelected}
          disabled={!annualPackage || isLoading || isLoggingOut || isRestoring}
          offerLabel={annualOfferLabel}
          onPress={() => {
            if (annualPackage) {
              setSelectedPackage(annualPackage);
            }
          }}
        />
      </View>

      <OnboardingPrimaryButton
        className="mt-3"
        label={isPackagesLoading ? 'Loading plans...' : 'Start Premium'}
        onPress={handlePurchase}
        disabled={isCtaDisabled}
        isLoading={isLoading}
      />

      <Text className="mt-4 text-center font-body text-sm text-[#8B8B8B]">
        Instant access. Cancel anytime.
      </Text>

      <View className="mt-7 flex-row items-center justify-center">
        <Link href="/legals/terms">
          <Text className="font-body text-sm text-[#5F5F5F]">Terms</Text>
        </Link>
        <Text className="mx-4 font-body text-sm text-[#5F5F5F]">|</Text>
        <Link href="/legals/privacy-policy">
          <Text className="font-body text-sm text-[#5F5F5F]">Privacy Policy</Text>
        </Link>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={!restorePermissions || isRestoring || isLoading || isLoggingOut}
        onPress={handleRestore}
        className="mt-2 items-center py-2">
        {isRestoring ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#FF5C1A" />
            <Text className="ml-2 font-body text-xs font-semibold text-[#FF5C1A]">
              Restoring purchases...
            </Text>
          </View>
        ) : (
          <Text className="font-body text-xs font-semibold text-[#777777] underline">
            Restore purchases
          </Text>
        )}
      </TouchableOpacity>

      {showBackToLogin === 'true' ? (
        <TouchableOpacity
          onPress={handleBackToLogin}
          disabled={isLoggingOut || isLoading || isRestoring}
          activeOpacity={0.7}
          className="items-center py-3">
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
    </ScrollView>
  );
}
