// @ts-nocheck -- Bun-only store-metadata fixtures.
import { expect, test } from 'bun:test';

import { billingPeriodLabel, freeTrialLabel } from '../shared/subscriptionPresentation';

const product = { subscriptionPeriod: 'P1Y', introPrice: { price: 0, period: 'P1W', cycles: 1 } };

test('store period disclosures support monthly, annual, and multi-month billing', () => {
  expect(billingPeriodLabel('P1M')).toBe('month');
  expect(billingPeriodLabel('P1Y')).toBe('year');
  expect(billingPeriodLabel('P3M')).toBe('3 months');
  expect(billingPeriodLabel(null)).toBeNull();
  expect(billingPeriodLabel('P0D')).toBeNull();
});

test('iOS unknown or ineligible status never promises free access', () => {
  expect(freeTrialLabel(product, 'ios', false)).toBeNull();
  expect(freeTrialLabel(product, 'ios', true)).toBe('1 week');
  expect(
    freeTrialLabel({ ...product, introPrice: { price: 1, period: 'P1W', cycles: 1 } }, 'ios', true)
  ).toBeNull();
  expect(freeTrialLabel({ ...product, introPrice: null }, 'ios', true)).toBeNull();
});

test('a seven-day trial comes from the store, and multiple introductory cycles are counted', () => {
  expect(freeTrialLabel({ introPrice: { price: 0, period: 'P7D', cycles: 1 } }, 'ios', true)).toBe(
    '7 days'
  );
  expect(freeTrialLabel({ introPrice: { price: 0, period: 'P1M', cycles: 2 } }, 'ios', true)).toBe(
    '2 months'
  );
});

test('Android uses the actual default purchase option rather than iOS eligibility or samples', () => {
  expect(freeTrialLabel(product, 'android', true)).toBeNull();
  const play = {
    defaultOption: { freePhase: { billingPeriod: { iso8601: 'P14D' }, billingCycleCount: 1 } },
  };
  expect(freeTrialLabel(play, 'android', false)).toBe('14 days');
  expect(freeTrialLabel({ defaultOption: { freePhase: null } }, 'android', true)).toBeNull();
});
