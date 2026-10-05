import type { PurchasesStoreProduct } from 'react-native-purchases';

/** Store metadata drives both the disclosure and the offer, never prototype sample prices. */
export function billingPeriodLabel(period: string | null | undefined) {
  const match = /^P(\d+)([DWMY])$/.exec(period ?? '');
  if (!match) return null;
  const count = Number(match[1]);
  if (count < 1) return null;
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[match[2]];
  return count === 1 ? unit! : `${count} ${unit}s`;
}

export function freeTrialLabel(
  product: PurchasesStoreProduct | undefined,
  platform: string,
  iosEligible: boolean
) {
  if (!product) return null;
  if (platform === 'android') {
    // RevenueCat's default purchase option contains the Play-returned offer for this user.
    const phase = product.defaultOption?.freePhase;
    if (!phase) return null;
    return durationLabel(phase.billingPeriod.iso8601, phase.billingCycleCount ?? 1);
  }
  if (platform !== 'ios' || !iosEligible || product.introPrice?.price !== 0) return null;
  return durationLabel(product.introPrice.period, product.introPrice.cycles);
}

function durationLabel(period: string, cycles: number) {
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match || cycles < 1) return null;
  const label = billingPeriodLabel(`P${Number(match[1]) * cycles}${match[2]}`);
  return Number(match[1]) * cycles === 1 && label ? `1 ${label}` : label;
}
