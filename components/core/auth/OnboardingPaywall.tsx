import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Sparkle } from 'phosphor-react-native';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrototypeButton, PrototypeError, onboardingStyles } from './PrototypeOnboarding';

import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { billingPeriodLabel } from '~/shared/subscriptionPresentation';

interface Props {
  firstName?: string;
  annualPackage?: PurchasesPackage;
  monthlyPackage?: PurchasesPackage;
  selectedPackage: PurchasesPackage | null;
  selectPackage: (pack: PurchasesPackage) => void;
  annualMonthlyPrice: string | null;
  annualOfferLabel: string;
  trial: string | null;
  checkingEligibility: boolean;
  offeringsLoading: boolean;
  offeringsError: string | null;
  reloadOfferings: () => Promise<void>;
  busy: boolean;
  purchasing: boolean;
  restoring: boolean;
  loggingOut: boolean;
  hasActiveStoreSubscription: boolean;
  ctaDisabled: boolean;
  restoreDisabled: boolean;
  onPurchase: () => Promise<void>;
  onRestore: () => Promise<void>;
  onBackToLogin: () => Promise<void>;
}

const features = [
  [
    'coach',
    'Your AI Progress Coach',
    'Tracks your activity, gives you feedback on your meals, then adjusts your plan.',
  ],
  [
    'zap',
    'Daily Routine Planned For You',
    'Your steps, workouts, and meals, so you know exactly what to do to reach your goals.',
  ],
  ['music', 'Fun Workouts', 'Access high-energy Afrobeats routines with music you love.'],
  [
    'users',
    'Real Sisterhood',
    'Join other women and coaches who keep you accountable and motivated.',
  ],
] as const;

const small = { ...type.caption };

function StorePlan({
  pack,
  title,
  selected,
  disabled,
  onPress,
  monthlyEquivalent,
  offerLabel,
}: {
  pack: PurchasesPackage;
  title: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  monthlyEquivalent?: string | null;
  offerLabel?: string;
}) {
  const period = billingPeriodLabel(pack.product.subscriptionPeriod);
  const annualEquivalent =
    monthlyEquivalent && ['P1Y', 'P12M'].includes(pack.product.subscriptionPeriod ?? '');
  const pricing = annualEquivalent
    ? `${monthlyEquivalent} / month (${pack.product.priceString} billed every ${period})`
    : `${pack.product.priceString}${period ? ` / ${period}` : ''}`;
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${pricing}`}
      accessibilityState={{ selected, disabled }}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={{
        ...chrome.option,
        borderColor: selected ? '#ff5a1f' : '#ececec',
        backgroundColor: selected ? '#fff3ea' : '#fff',
        opacity: disabled ? 0.65 : 1,
      }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Text
            style={{
              ...type[selected ? 'selectedOption' : 'option'],
            }}>
            {title}
          </Text>
          {offerLabel && (
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: '#ffe3d3',
              }}>
              <Text style={[type.badge, { color: '#e8541e' }]}>{offerLabel}</Text>
            </View>
          )}
        </View>
        <Text style={[small, { marginTop: 2 }]}>{pricing}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: selected ? '#ff5a1f' : '#d9d9d9',
          backgroundColor: selected ? '#ff5a1f' : '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {selected && <Feather name="check" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

export function OnboardingPaywall(props: Props) {
  const insets = useSafeAreaInsets();
  const product = props.selectedPackage?.product;
  const period = billingPeriodLabel(product?.subscriptionPeriod);
  const cta = props.offeringsLoading
    ? 'Loading plans…'
    : props.hasActiveStoreSubscription
      ? 'Verify Premium access'
      : props.checkingEligibility
        ? 'Checking trial eligibility…'
        : props.trial
          ? `Try free for ${props.trial}`
          : 'Subscribe';
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 12,
          paddingLeft: 22 + insets.left,
          paddingRight: 22 + insets.right,
          paddingBottom: Math.max(12, 34 - insets.bottom),
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out and return to login"
          accessibilityState={{ disabled: props.busy }}
          disabled={props.busy}
          onPress={props.onBackToLogin}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            alignSelf: 'flex-start',
            minHeight: 44,
          }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#f5f5f5',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {props.loggingOut ? (
              <ActivityIndicator color="#2a2a2a" />
            ) : (
              <Feather name="chevron-left" size={22} color="#2a2a2a" />
            )}
          </View>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#2a2a2a' }}>
            {props.loggingOut ? 'Signing out…' : 'Back to login'}
          </Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[onboardingStyles.heading, { marginTop: 20 }]}>
          {props.firstName
            ? `${props.firstName}, your custom routine is ready.`
            : 'Your custom routine is ready.'}
        </Text>
        <View style={{ marginTop: 24, gap: 18 }}>
          {features.map(([icon, title, detail]) => (
            <View key={title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View
                style={{
                  ...chrome.iconTile,
                }}>
                {icon === 'coach' ? (
                  <Sparkle size={24} color="#e8541e" />
                ) : (
                  <Feather name={icon} size={24} color="#e8541e" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...type.compactCardTitle,
                  }}>
                  {title}
                </Text>
                <Text style={[small, { marginTop: 1 }]}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 28, gap: 12 }}>
          {props.annualPackage && (
            <StorePlan
              pack={props.annualPackage}
              title="Annual Plan"
              selected={props.selectedPackage?.identifier === props.annualPackage.identifier}
              disabled={props.busy}
              monthlyEquivalent={props.annualMonthlyPrice}
              offerLabel={props.annualOfferLabel}
              onPress={() => props.selectPackage(props.annualPackage!)}
            />
          )}
          {props.monthlyPackage && (
            <StorePlan
              pack={props.monthlyPackage}
              title="Monthly Plan"
              selected={props.selectedPackage?.identifier === props.monthlyPackage.identifier}
              disabled={props.busy}
              onPress={() => props.selectPackage(props.monthlyPackage!)}
            />
          )}
          {props.offeringsLoading && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Loading subscription plans"
              style={{ flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' }}>
              <ActivityIndicator color="#2a2a2a" />
              <Text style={small}>Loading subscription plans…</Text>
            </View>
          )}
          <PrototypeError
            error={
              props.offeringsError ??
              (!props.offeringsLoading && !props.annualPackage && !props.monthlyPackage
                ? 'No subscription plans are available right now.'
                : '')
            }
          />
          {!props.offeringsLoading &&
            (props.offeringsError || (!props.annualPackage && !props.monthlyPackage)) && (
              <PrototypeButton
                secondary
                label="Try again"
                onPress={() => {
                  props.reloadOfferings().catch(() => {});
                }}
                disabled={props.busy}
              />
            )}
        </View>
        {props.trial && !props.hasActiveStoreSubscription && (
          <Text style={[small, { marginTop: 20, textAlign: 'center' }]}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#2a2a2a' }}>
              {props.trial} free:{' '}
            </Text>
            Enable notifications after setup for a reminder 2 days before your trial ends.
          </Text>
        )}
        <View style={{ marginTop: 'auto', paddingTop: 20, gap: 12 }}>
          <PrototypeButton
            label={cta}
            onPress={props.onPurchase}
            disabled={props.ctaDisabled}
            loading={props.hasActiveStoreSubscription ? props.restoring : props.purchasing}
          />
          <Text style={[small, { textAlign: 'center' }]}>
            {product
              ? `${props.trial && !props.hasActiveStoreSubscription ? `After ${props.trial} free, ` : ''}${product.priceString}${period ? ` every ${period}` : ''}. `
              : ''}
            Automatically renews unless cancelled. Cancel in your store account settings before
            renewal.
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
            <Link href="/legals/terms" style={{ minHeight: 44, paddingVertical: 12 }}>
              <Text style={small}>Terms</Text>
            </Link>
            <Link href="/legals/privacy-policy" style={{ minHeight: 44, paddingVertical: 12 }}>
              <Text style={small}>Privacy Policy</Text>
            </Link>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: props.restoreDisabled, busy: props.restoring }}
            disabled={props.restoreDisabled}
            onPress={props.onRestore}
            style={{
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: props.restoreDisabled ? 0.65 : 1,
            }}>
            {props.restoring && <ActivityIndicator color="#2a2a2a" />}
            <Text
              style={[small, { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' }]}>
              {props.restoring ? 'Restoring purchases…' : 'Restore purchases'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
