import { useAuthActions } from '@convex-dev/auth/react';
import { useConvex, useQuery } from 'convex/react';
import * as Localization from 'expo-localization';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Icon from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { resumeMember } from '~/utils/coachResumeNavigation';

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
      style={{
        minHeight: 84,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: selected ? '#FF5C1A' : '#E0E1E2',
        backgroundColor: selected ? '#FFF7F3' : '#F8FAFB',
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: disabled ? 0.55 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
          <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111111' }}>
            {title}
          </Text>
          {offerLabel ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: '#FF5C1A',
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF' }}>
                {offerLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{
            marginTop: 6,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: '#737373',
          }}>
          {price ? `${price}${billingSuffix}` : 'Loading...'}
          {detail ? ` (${detail})` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Paywall({ onboarding = false }: { onboarding?: boolean }) {
  const { showBackToLogin } = useLocalSearchParams<{
    showBackToLogin?: string;
  }>();
  const convex = useConvex();
  const decision = useQuery(api.coachResume.myDecision, {});

  const { signOut } = useAuthActions();

  const currentUser = useAuthStore((state) => state.currentUser);
  const firstName = currentUser?.name?.trim().split(' ')[0];
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { packages, purchasePackage, restorePermissions, hasActiveStoreSubscription } =
    useRevenueCat();

  useEffect(() => {
    // A delayed webhook or a verified restore after restart uses persisted server state.
    if (decision?.verifiedAccess && decision.screen !== 'paywall')
      resumeMember(convex).catch(() => {});
  }, [convex, decision?.verifiedAccess, decision?.screen]);

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

  const annualOfferLabel =
    annualSaving > 0 && monthlyPackage
      ? `SAVE ${Math.round((annualSaving / (monthlyPackage.product.price * 12)) * 100)}%`
      : 'BEST VALUE';

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
    {
      icon: '⚡',
      title: 'Daily Routine Planned For You:',
      detail: 'Know exactly what to do each day to reach your goals.',
    },
    {
      icon: '🥗',
      title: 'Instant Meal Scans:',
      detail: 'Get portion suggestions for your meals within seconds.',
    },
    {
      icon: '🎶',
      title: 'Fun Afrobeat Workouts:',
      detail: 'Access high-energy routines with music you love.',
    },
    {
      icon: '👥',
      title: 'Real Sisterhood:',
      detail: 'Join other women on our leaderboard and stay motivated.',
    },
  ];

  const handlePurchase = async () => {
    if (!selectedPackage || !purchasePackage || isLoading || isLoggingOut) {
      return;
    }

    setIsLoading(true);

    const [purchaseError, verification] = await CatchPromise(purchasePackage(selectedPackage));

    if (purchaseError) {
      if (__DEV__) {
        console.log('Purchase error:', purchaseError);
      }

      setIsLoading(false);

      if (
        typeof purchaseError === 'object' &&
        purchaseError !== null &&
        'userCancelled' in purchaseError &&
        purchaseError.userCancelled === true
      )
        return;

      Alert.alert('Purchase failed', 'Unable to complete the purchase. Please try again.');

      return;
    }

    setIsLoading(false);

    if (verification !== 'active') {
      Alert.alert(
        'Verification pending',
        'Your purchase is saved. We will unlock Premium when payment is verified. You can retry or restore without repeating checkout.'
      );
      return;
    }

    await resumeMember(convex);
  };

  const handlePrimaryAction = async () => {
    if (hasActiveStoreSubscription) {
      await handleRestore();
      return;
    }

    await handlePurchase();
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
      const verification = await restorePermissions();

      if (verification !== 'active') {
        Alert.alert(
          verification === 'pending' ? 'Verification pending' : 'No subscription found',
          verification === 'pending'
            ? 'We could not verify this purchase yet. Please try Restore again shortly.'
            : 'We could not find an active Premium subscription.'
        );
        return;
      }

      await resumeMember(convex);
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
    <View className="flex-1 bg-[#F8FAFB]">
      <StatusBar style="dark" />
      {onboarding || showBackToLogin === 'true' ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out and return to login"
          accessibilityState={{ disabled: isLoggingOut || isLoading || isRestoring }}
          onPress={handleBackToLogin}
          disabled={isLoggingOut || isLoading || isRestoring}
          activeOpacity={0.7}
          className="mx-6 mt-2 min-h-11 flex-row items-center self-start rounded-[20px] px-2">
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#FF5C1A" />
          ) : (
            <Icon.ArrowLeft size={20} color="#FF5C1A" weight="bold" />
          )}
          <Text
            className="ml-2 text-[#E9512A]"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
            {isLoggingOut ? 'Signing out…' : 'Back to login'}
          </Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView
        className="flex-1 bg-[#F8FAFB]"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}>
        <View style={{ alignItems: 'center', paddingTop: 20, paddingHorizontal: 4 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 12,
              letterSpacing: 1,
              color: '#FF5C1A',
            }}>
            YOUR PLAN IS READY
          </Text>
          <Text
            style={{
              marginTop: 6,
              textAlign: 'center',
              fontFamily: 'Inter_700Bold',
              fontSize: 23,
              lineHeight: 28,
              color: '#080808',
            }}>
            {firstName
              ? `${firstName}, your custom routine is ready.`
              : 'Your custom routine is ready.'}
          </Text>
        </View>

        <View style={{ marginTop: 24, gap: 14 }}>
          {paywallBullets.map((item) => (
            <View key={item.title} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ width: 24, marginRight: 8, fontSize: 16, lineHeight: 20 }}>
                {item.icon}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  lineHeight: 20,
                  color: '#383838',
                }}>
                <Text style={{ fontFamily: 'Inter_700Bold' }}>{item.title}</Text> {item.detail}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <PlanCard
            title="Annual Plan"
            price={annualMonthlyPrice ?? undefined}
            billingSuffix=" / month"
            detail={annualPackage ? `${annualPackage.product.priceString} billed annually` : ''}
            selected={isAnnualSelected}
            disabled={!annualPackage || isLoading || isLoggingOut || isRestoring}
            offerLabel={annualOfferLabel}
            onPress={() => {
              if (annualPackage) setSelectedPackage(annualPackage);
            }}
          />
          <PlanCard
            title="Monthly Plan"
            price={monthlyPackage?.product.priceString}
            billingSuffix=" / month"
            detail=""
            selected={isMonthlySelected}
            disabled={!monthlyPackage || isLoading || isLoggingOut || isRestoring}
            onPress={() => {
              if (monthlyPackage) setSelectedPackage(monthlyPackage);
            }}
          />
        </View>

        <View
          style={{
            marginTop: 14,
            borderRadius: 14,
            backgroundColor: '#FFF4DF',
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12,
              lineHeight: 17,
              color: '#4F4F4F',
            }}>
            <Text style={{ fontFamily: 'Inter_700Bold' }}>🔖 7 Days Free:</Text> We'll remind you 2
            days before your trial ends.
          </Text>
        </View>

        <OnboardingPrimaryButton
          className="mt-4"
          borderRadius={18}
          labelFontSize={18}
          label={
            isPackagesLoading
              ? 'Loading plans...'
              : hasActiveStoreSubscription
                ? 'Verify Premium access'
                : 'Try free for 7 days'
          }
          onPress={handlePrimaryAction}
          disabled={hasActiveStoreSubscription ? isRestoring || isLoggingOut : isCtaDisabled}
          isLoading={hasActiveStoreSubscription ? isRestoring : isLoading}
        />

        <Text
          style={{
            marginTop: 8,
            textAlign: 'center',
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            color: '#8B8B8B',
          }}>
          Recurring billing. Cancel anytime in Settings.
        </Text>

        <View className="mt-5 flex-row items-center justify-center">
          <Link href="/legals/terms">
            <Text className="font-body text-xs text-[#5F5F5F]">Terms</Text>
          </Link>
          <Text className="mx-4 font-body text-xs text-[#5F5F5F]">|</Text>
          <Link href="/legals/privacy-policy">
            <Text className="font-body text-xs text-[#5F5F5F]">Privacy Policy</Text>
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
      </ScrollView>
    </View>
  );
}
