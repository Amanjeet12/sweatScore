import { useAction } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Localization from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { CatchPromise } from '~/utils/catch-promise';

export default function Paywall() {
  const { redirectTo } = useLocalSearchParams<{ redirectTo: string }>();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { packages, purchasePackage } = useRevenueCat();
  const syncToEnduranceZone = useAction(api.users.syncToEnduranceZone);

  // Find monthly and annual packages
  const monthlyPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === '$rc_monthly'),
    [packages]
  );
  const annualPackage = useMemo(
    () => packages.find((pkg) => pkg.identifier === '$rc_annual'),
    [packages]
  );

  // Set annual package as default when packages load
  useEffect(() => {
    if (annualPackage && !selectedPackage) {
      setSelectedPackage(annualPackage);
    }
  }, [annualPackage, selectedPackage]);

  // Calculate savings percentage
  const savingsPercentage = useMemo(() => {
    if (!monthlyPackage || !annualPackage) return 0;
    const monthlyPerYear = monthlyPackage.product.price * 12;
    const annualPrice = annualPackage.product.price;
    if (!monthlyPerYear || !annualPrice) return 0;
    const savings = ((monthlyPerYear - annualPrice) / monthlyPerYear) * 100;
    return Math.round(savings);
  }, [monthlyPackage, annualPackage]);

  const handlePurchase = async () => {
    setIsLoading(true);
    if (selectedPackage && purchasePackage) {
      const [err, _] = await CatchPromise(purchasePackage(selectedPackage));
      if (err) {
        setIsLoading(false);
        return;
      }

      // Purchase successful - sync to Endurance Zone to update level
      const userCountry = Localization.getLocales()[0]?.regionCode || 'UK';
      await CatchPromise(syncToEnduranceZone({ country: userCountry }));
      // Note: We don't block redirect if sync fails - it will retry when user visits Win tab

      // Redirect after a short delay
      setTimeout(() => {
        setIsLoading(false);
        if (redirectTo) {
          router.replace(redirectTo as any);
        } else {
          router.back();
        }
      }, 500);
    } else {
      setIsLoading(false);
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
        {/* Header */}
        <View className="items-center">
          <Text
            className="text-center text-xl text-[#1A1A1A]"
            style={{ fontFamily: 'Inter_700Bold' }}>
            Move Daily. Earn Points. Go Further.
          </Text>
          {/* <Text className="mt-2 text-center text-sm text-gray-600">
            Convert your points into cash and rewards.{'\n'}Move more. Stay consistent. Start
            winning.
          </Text> */}
        </View>

        {/* Features List */}
        <View className="mx-6 mt-4 flex-col gap-y-4">
          {features.map((feature, index) => (
            <View key={index} className="flex-row items-center justify-center gap-x-4">
              <View
                className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: '#FFF0E6' }}>
                {feature.icon}
              </View>
              <View className="flex-1">
                <Text
                  className="text-base text-[#1A1A1A]"
                  style={{ fontFamily: 'Inter_700Bold' }}>
                  {feature.title}
                </Text>
                <Text className="text-sm text-gray-600">{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Options - Switch Style */}
        <View className="mt-10" style={{ position: 'relative' }}>
          {/* Best Value Badge */}
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
            {/* Annual Plan */}
            <TouchableOpacity
              onPress={() => annualPackage && setSelectedPackage(annualPackage)}
              className="flex-1 items-center justify-center rounded-full px-4"
              style={{
                backgroundColor:
                  selectedPackage?.identifier === '$rc_annual' ? '#FFEEE1' : 'transparent',
                borderWidth: selectedPackage?.identifier === '$rc_annual' ? 1 : 0,
                borderColor:
                  selectedPackage?.identifier === '$rc_annual' ? '#FF5C1A' : 'transparent',
                height: 50,
              }}>
              <View className="items-center">
                <Text className="text-base font-bold text-[#1A1A1A]">
                  Annual — {annualPackage?.product.priceString || '$74.99'}
                </Text>
                <Text className="text-xs text-gray-600">Save {savingsPercentage}%</Text>
              </View>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              onPress={() => monthlyPackage && setSelectedPackage(monthlyPackage)}
              className="flex-1 items-center justify-center rounded-full px-6"
              style={{
                backgroundColor:
                  selectedPackage?.identifier === '$rc_monthly' ? '#FFEEE1' : 'transparent',
                borderWidth: selectedPackage?.identifier === '$rc_monthly' ? 1 : 0,
                borderColor:
                  selectedPackage?.identifier === '$rc_monthly' ? '#FF5C1A' : 'transparent',
                height: 50,
              }}>
              <View className="items-center">
                <Text className="text-base font-bold text-[#1A1A1A]">
                  Monthly — {monthlyPackage?.product.priceString || '$8.99'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA Button */}
        <View className="mt-4">
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={!selectedPackage || isLoading}
            style={{
              borderRadius: 9999,
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
                <Text className="text-2xl font-bold text-white">Let&apos;s Go</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer Text */}
        <View className="mt-2">
          <Text className="text-center text-base text-gray-600">
            Cancel anytime. Instant access.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
