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
import { PurchasesPackage } from 'react-native-purchases';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { CatchPromise } from '~/utils/catch-promise';

const MONTHLY_PACKAGE_ID = '$rc_monthly';
const ANNUAL_PACKAGE_ID = '$rc_annual';

export default function Paywall() {
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { packages, purchasePackage } = useRevenueCat();
  const syncToEnduranceZone = useAction(api.users.syncToEnduranceZone);

  if (__DEV__) {
    console.log('Available packages from RevenueCat:', packages);
  }

  const monthlyPackage = useMemo(() => {
    return packages.find((pkg) => pkg.identifier === MONTHLY_PACKAGE_ID);
  }, [packages]);

  const annualPackage = useMemo(() => {
    return packages.find((pkg) => pkg.identifier === ANNUAL_PACKAGE_ID);
  }, [packages]);

  const isPackagesLoading = packages.length === 0;

  useEffect(() => {
    if (selectedPackage) return;

    if (annualPackage) {
      setSelectedPackage(annualPackage);
      return;
    }

    if (monthlyPackage) {
      setSelectedPackage(monthlyPackage);
    }
  }, [annualPackage, monthlyPackage, selectedPackage]);

  const savingsPercentage = useMemo(() => {
    if (!monthlyPackage || !annualPackage) return 0;

    const monthlyPerYear = monthlyPackage.product.price * 12;
    const annualPrice = annualPackage.product.price;

    if (!monthlyPerYear || !annualPrice) return 0;
    if (annualPrice >= monthlyPerYear) return 0;

    const savings = ((monthlyPerYear - annualPrice) / monthlyPerYear) * 100;
    return Math.round(savings);
  }, [monthlyPackage, annualPackage]);

  const handlePurchase = async () => {
    if (!selectedPackage || !purchasePackage || isLoading) return;

    setIsLoading(true);

    const [purchaseErr] = await CatchPromise(purchasePackage(selectedPackage));

    if (purchaseErr) {
      if (__DEV__) {
        console.log('Purchase error:', purchaseErr);
      }

      setIsLoading(false);
      Alert.alert('Purchase failed', 'Unable to complete the purchase. Please try again.');
      return;
    }

    const userCountry = Localization.getLocales()[0]?.regionCode || 'UK';

    // Do not block redirect if sync fails.
    await CatchPromise(syncToEnduranceZone({ country: userCountry }));

    setIsLoading(false);

    if (redirectTo) {
      router.replace(redirectTo as any);
    } else {
      router.back();
    }
  };

  const features = [
    {
      icon: <Icon.Target size={20} color="#FF5C1A" weight="fill" />,
      title: 'No daily points limits',
      description: 'Never leave points on the table',
    },
    {
      icon: <Icon.Lightning size={20} color="#FF5C1A" weight="fill" />,
      title: 'Workout with every trainer',
      description: 'More styles, more vibes. Never get bored.',
    },
    {
      icon: <Icon.ChartLineUp size={20} color="#FF5C1A" weight="fill" />,
      title: 'Track your consistency',
      description: 'See your full progress, all year round.',
    },
    {
      icon: <Icon.UsersThree size={20} color="#FF5C1A" weight="fill" />,
      title: 'Stay accountable',
      description: 'Post, be seen, and never miss a moment.',
    },
  ];

  const isAnnualSelected = selectedPackage?.identifier === ANNUAL_PACKAGE_ID;
  const isMonthlySelected = selectedPackage?.identifier === MONTHLY_PACKAGE_ID;
  const isCtaDisabled = !selectedPackage || !purchasePackage || isLoading || isPackagesLoading;

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
            height: '30%',
          }}
        />
      </View>

      <View className="rounded-t-3xl bg-[#FFF7F6] px-6 pb-8 pt-6">
        <View className="items-center">
          <Text
            className="text-center text-xl text-[#1A1A1A]"
            style={{ fontFamily: 'Inter_700Bold' }}>
            Move Daily. Earn Points. Go Further.
          </Text>
        </View>

        <View className="mx-6 mt-4 flex-col gap-y-4">
          {features.map((feature, index) => (
            <View key={index} className="flex-row items-center justify-center gap-x-4">
              <View
                className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: '#FFF0E6' }}>
                {feature.icon}
              </View>

              <View className="flex-1">
                <Text className="text-base text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
                  {feature.title}
                </Text>
                <Text className="text-sm text-gray-600">{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-10" style={{ position: 'relative' }}>
          {annualPackage && (
            <View
              className="absolute top-0 z-10"
              style={{
                left: '12%',
                transform: [{ translateY: -16 }],
              }}>
              <View
                style={{
                  backgroundColor: '#FF5C1A',
                  borderRadius: 9999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}>
                <Text className="text-sm font-semibold text-white">Best value</Text>
              </View>
            </View>
          )}

          <View
            className="flex-row gap-x-2 rounded-full bg-white p-1"
            style={{
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <TouchableOpacity
              disabled={!annualPackage || isLoading}
              onPress={() => {
                if (annualPackage) setSelectedPackage(annualPackage);
              }}
              className="flex-1 items-center justify-center rounded-full px-4"
              style={{
                backgroundColor: isAnnualSelected ? '#FFEEE1' : 'transparent',
                borderWidth: isAnnualSelected ? 1 : 0,
                borderColor: isAnnualSelected ? '#FF5C1A' : 'transparent',
                height: 50,
                opacity: annualPackage ? 1 : 0.5,
              }}>
              <View className="items-center">
                <Text className="text-base font-bold text-[#1A1A1A]">
                  Annual — {annualPackage?.product.priceString ?? 'Loading...'}
                </Text>

                <Text className="text-xs text-gray-600">
                  {savingsPercentage > 0 ? `Save ${savingsPercentage}%` : 'Best yearly price'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!monthlyPackage || isLoading}
              onPress={() => {
                if (monthlyPackage) setSelectedPackage(monthlyPackage);
              }}
              className="flex-1 items-center justify-center rounded-full px-6"
              style={{
                backgroundColor: isMonthlySelected ? '#FFEEE1' : 'transparent',
                borderWidth: isMonthlySelected ? 1 : 0,
                borderColor: isMonthlySelected ? '#FF5C1A' : 'transparent',
                height: 50,
                opacity: monthlyPackage ? 1 : 0.5,
              }}>
              <View className="items-center">
                <Text className="text-base font-bold text-[#1A1A1A]">
                  Monthly — {monthlyPackage?.product.priceString ?? 'Loading...'}
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
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                  }
                : {
                    elevation: 3,
                  }),
            }}>
            <View
              style={{
                backgroundColor: '#FF5C1A',
                borderRadius: 9999,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              {isLoading ? (
                <View className="flex-row items-center justify-center">
                  <Text className="mr-2 text-2xl font-bold text-white">Processing...</Text>
                  <ActivityIndicator size={20} color="#fff" />
                </View>
              ) : (
                <Text className="text-2xl font-bold text-white">
                  {isPackagesLoading ? 'Loading plans...' : "Let's Go"}
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
      </View>
    </ScrollView>
  );
}