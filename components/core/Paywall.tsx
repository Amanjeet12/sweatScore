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
import Purchases, {
  PurchasesPackage,
} from 'react-native-purchases';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';

const QUARTERLY_PACKAGE_ID = '$rc_three_month';
const ANNUAL_PACKAGE_ID = '$rc_annual';

export default function Paywall() {
  const { redirectTo, showBackToLogin } =
    useLocalSearchParams<{
      redirectTo?: string;
      showBackToLogin?: string;
    }>();

  const { signOut } = useAuthActions();

  const setCurrentUser = useAuthStore(
    (state) => state.setCurrentUser
  );

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const { packages, purchasePackage } = useRevenueCat();

  const syncToEnduranceZone = useAction(
    api.users.syncToEnduranceZone
  );

  if (__DEV__) {
    console.log(
      'Available packages from RevenueCat:',
      packages
    );
  }

  const quarterlyPackage = useMemo(
    () =>
      packages.find(
        (pkg) =>
          pkg.identifier === QUARTERLY_PACKAGE_ID
      ),
    [packages]
  );

  const annualPackage = useMemo(
    () =>
      packages.find(
        (pkg) => pkg.identifier === ANNUAL_PACKAGE_ID
      ),
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
  }, [
    annualPackage,
    quarterlyPackage,
    selectedPackage,
  ]);

  const savingsPercentage = useMemo(() => {
    if (!quarterlyPackage || !annualPackage) return 0;

    const quarterlyPerYear =
      quarterlyPackage.product.price * 4;

    const annualPrice = annualPackage.product.price;

    if (!quarterlyPerYear || !annualPrice) return 0;
    if (annualPrice >= quarterlyPerYear) return 0;

    return Math.round(
      ((quarterlyPerYear - annualPrice) /
        quarterlyPerYear) *
        100
    );
  }, [quarterlyPackage, annualPackage]);

  const handlePurchase = async () => {
    if (
      !selectedPackage ||
      !purchasePackage ||
      isLoading ||
      isLoggingOut
    ) {
      return;
    }

    setIsLoading(true);

    const [purchaseError] = await CatchPromise(
      purchasePackage(selectedPackage)
    );

    if (purchaseError) {
      if (__DEV__) {
        console.log(
          'Purchase error:',
          purchaseError
        );
      }

      setIsLoading(false);

      Alert.alert(
        'Purchase failed',
        'Unable to complete the purchase. Please try again.'
      );

      return;
    }

    const userCountry =
      Localization.getLocales()[0]?.regionCode || 'UK';

    await CatchPromise(
      syncToEnduranceZone({
        country: userCountry,
      })
    );

    setIsLoading(false);
    router.dismissAll();

    router.replace(
      (redirectTo || '/(tabs)/dashboard') as any
    );
  };

  const handleBackToLogin = async () => {
    if (isLoggingOut || isLoading) return;

    setIsLoggingOut(true);

    try {
      try {
        await Purchases.logOut();
      } catch (error) {
        console.warn(
          '[RevenueCat] Logout failed:',
          error
        );
      }

      await signOut();
      await setCurrentUser(null);

      router.dismissAll();
      router.replace('/(auth)/email');
    } catch (error) {
      console.error('Logout failed:', error);

      Alert.alert(
        'Logout failed',
        'Unable to return to login. Please try again.'
      );

      setIsLoggingOut(false);
    }
  };

  const features = [
    {
      icon: (
        <Icon.Target
          size={20}
          color="#FF5C1A"
          weight="fill"
        />
      ),
      title: 'No daily points limits',
      description: 'Never leave points on the table',
    },
    {
      icon: (
        <Icon.Lightning
          size={20}
          color="#FF5C1A"
          weight="fill"
        />
      ),
      title: 'Workout with every trainer',
      description:
        'More styles, more vibes. Never get bored.',
    },
    {
      icon: (
        <Icon.ChartLineUp
          size={20}
          color="#FF5C1A"
          weight="fill"
        />
      ),
      title: 'Track your consistency',
      description:
        'See your full progress, all year round.',
    },
    {
      icon: (
        <Icon.UsersThree
          size={20}
          color="#FF5C1A"
          weight="fill"
        />
      ),
      title: 'Stay accountable',
      description:
        'Post, be seen, and never miss a moment.',
    },
  ];

  const isAnnualSelected =
    selectedPackage?.identifier === ANNUAL_PACKAGE_ID;

  const isQuarterlySelected =
    selectedPackage?.identifier ===
    QUARTERLY_PACKAGE_ID;

  const isCtaDisabled =
    !selectedPackage ||
    !purchasePackage ||
    isLoading ||
    isLoggingOut ||
    isPackagesLoading;

  return (
    <ScrollView
      className="flex-1 bg-[#FFF7F6]"
      showsVerticalScrollIndicator={false}
    >
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
          colors={[
            'rgba(255,247,246,0)',
            '#FFF7F6',
          ]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '30%',
          }}
        />
      </View>

      <View className="rounded-t-3xl bg-[#FFF7F6] px-6 pb-8 pt-6">
        <View className="items-center">
          <Text
            className="text-center text-xl text-[#1A1A1A]"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Move Daily. Earn Points. Go Further.
          </Text>
        </View>

        <View className="mx-6 mt-4 flex-col gap-y-4">
          {features.map((feature, index) => (
            <View
              key={index}
              className="flex-row items-center justify-center gap-x-4"
            >
              <View
                className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: '#FFF0E6',
                }}
              >
                {feature.icon}
              </View>

              <View className="flex-1">
                <Text
                  className="text-base text-[#1A1A1A]"
                  style={{
                    fontFamily: 'Inter_700Bold',
                  }}
                >
                  {feature.title}
                </Text>

                <Text className="text-sm text-gray-600">
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View
          className="mt-10"
          style={{ position: 'relative' }}
        >
          {annualPackage && (
            <View
              className="absolute top-0 z-10"
              style={{
                left: 18,
                transform: [{ translateY: -14 }],
              }}
            >
              <View
                style={{
                  backgroundColor: '#FF5C1A',
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text className="text-sm font-semibold text-white">
                  Best value
                </Text>
              </View>
            </View>
          )}

          <View
            className="flex-row gap-x-2 rounded-[28px] bg-white p-1"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}
          >
            <TouchableOpacity
              disabled={
                !annualPackage ||
                isLoading ||
                isLoggingOut
              }
              onPress={() => {
                if (annualPackage) {
                  setSelectedPackage(annualPackage);
                }
              }}
              className="flex-1 items-center justify-center rounded-[24px] px-2"
              style={{
                backgroundColor: isAnnualSelected
                  ? '#FFEEE1'
                  : 'transparent',
                borderWidth: isAnnualSelected ? 1 : 0,
                borderColor: isAnnualSelected
                  ? '#FF5C1A'
                  : 'transparent',
                minHeight: 68,
                opacity: annualPackage ? 1 : 0.5,
              }}
            >
              <View className="w-full items-center px-1">
                <Text className="text-sm font-semibold text-[#1A1A1A]">
                  Annual
                </Text>

                <Text
                  className="mt-0.5 text-base font-bold text-[#1A1A1A]"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {annualPackage?.product.priceString ??
                    'Loading...'}
                </Text>

                <Text
                  className="text-[11px] text-gray-600"
                  numberOfLines={1}
                >
                  {savingsPercentage > 0
                    ? `Save ${savingsPercentage}%`
                    : 'Best yearly price'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={
                !quarterlyPackage ||
                isLoading ||
                isLoggingOut
              }
              onPress={() => {
                if (quarterlyPackage) {
                  setSelectedPackage(
                    quarterlyPackage
                  );
                }
              }}
              className="flex-1 items-center justify-center rounded-[24px] px-2"
              style={{
                backgroundColor: isQuarterlySelected
                  ? '#FFEEE1'
                  : 'transparent',
                borderWidth: isQuarterlySelected
                  ? 1
                  : 0,
                borderColor: isQuarterlySelected
                  ? '#FF5C1A'
                  : 'transparent',
                minHeight: 68,
                opacity: quarterlyPackage ? 1 : 0.5,
              }}
            >
              <View className="w-full items-center px-1">
                <Text className="text-sm font-semibold text-[#1A1A1A]">
                  Quarterly
                </Text>

                <Text
                  className="mt-0.5 text-base font-bold text-[#1A1A1A]"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {quarterlyPackage?.product
                    .priceString ?? 'Loading...'}
                </Text>

                <Text className="text-[11px] text-gray-600">
                  Every 3 months
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-4">
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isCtaDisabled}
            style={{
              borderRadius: 9999,
              opacity: isCtaDisabled ? 0.6 : 1,
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}
          >
            <View
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 9999,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              {isLoading ? (
                <View className="flex-row items-center justify-center">
                  <Text className="mr-2 text-2xl font-bold text-white">
                    Processing...
                  </Text>

                  <ActivityIndicator
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
              ) : (
                <Text className="text-2xl font-bold text-white">
                  {isPackagesLoading
                    ? 'Loading plans...'
                    : "Let's Go"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-2">
          <Text className="text-center text-base text-gray-600">
            Cancel anytime. Instant access.
          </Text>
        </View>

        {showBackToLogin === 'true' && (
          <TouchableOpacity
            onPress={handleBackToLogin}
            disabled={isLoggingOut || isLoading}
            activeOpacity={0.7}
            className="mt-4 items-center py-3"
          >
            {isLoggingOut ? (
              <View className="flex-row items-center">
                <ActivityIndicator
                  size="small"
                  color="#FF5C1A"
                />

                <Text className="ml-2 text-base font-semibold text-[#FF5C1A]">
                  Signing out...
                </Text>
              </View>
            ) : (
              <Text className="text-base font-semibold text-[#FF5C1A]">
                Back to login
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}