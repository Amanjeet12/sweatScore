export type VerifiedPremium = {
  appUserId: string;
  active: boolean;
  providerCheckedAt: number;
  expiresAt?: number;
  productId?: string;
  isTrial?: boolean;
};

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;

export function parseRevenueCatSubscriber(
  value: unknown,
  appUserId: string,
  now: number
): VerifiedPremium {
  const root = object(value);
  const subscriber = object(root?.subscriber);
  const aliases = subscriber?.aliases;
  const original = subscriber?.original_app_user_id;
  if (
    !subscriber ||
    typeof original !== 'string' ||
    (original !== appUserId && !(Array.isArray(aliases) && aliases.includes(appUserId)))
  ) {
    throw new Error('revenuecat_identity_mismatch');
  }
  const providerCheckedAt = root?.request_date_ms;
  if (
    typeof providerCheckedAt !== 'number' ||
    !Number.isFinite(providerCheckedAt) ||
    providerCheckedAt > now + 300_000 ||
    providerCheckedAt < now - 86_400_000
  ) {
    throw new Error('revenuecat_invalid_timestamp');
  }
  const entitlement = object(object(subscriber.entitlements)?.Premium);
  if (!entitlement) return { appUserId, active: false, providerCheckedAt };
  const expiry = entitlement.expires_date;
  const grace = entitlement.grace_period_expires_date;
  const validExpiry = (date: unknown) => {
    if (date === null || date === undefined) return undefined;
    if (typeof date !== 'string') throw new Error('revenuecat_invalid_expiry');
    const parsed = Date.parse(date);
    if (!Number.isFinite(parsed)) throw new Error('revenuecat_invalid_expiry');
    return parsed;
  };
  const expiresAt = validExpiry(expiry);
  const graceAt = validExpiry(grace);
  const effectiveExpiry = Math.max(expiresAt ?? 0, graceAt ?? 0) || undefined;
  // Null expiry is RevenueCat's lifetime entitlement, not an unknown expiry.
  const active = expiry === null || (effectiveExpiry !== undefined && effectiveExpiry > now);
  const product =
    typeof entitlement.product_identifier === 'string' ? entitlement.product_identifier : undefined;
  const subscription = product ? object(object(subscriber.subscriptions)?.[product]) : null;
  return {
    appUserId,
    active,
    isTrial: active && subscription?.period_type === 'trial',
    providerCheckedAt,
    expiresAt: effectiveExpiry,
    productId:
      typeof entitlement.product_identifier === 'string'
        ? entitlement.product_identifier
        : undefined,
  };
}

export type RevenueCatEvent = {
  id: string;
  type: string;
  eventAt: number;
  appUserIds: string[];
};

export function parseRevenueCatEvent(value: unknown): RevenueCatEvent {
  const event = object(object(value)?.event);
  if (!event || typeof event.id !== 'string' || !event.id || typeof event.type !== 'string')
    throw new Error('revenuecat_invalid_event');
  if (typeof event.event_timestamp_ms !== 'number' || !Number.isFinite(event.event_timestamp_ms))
    throw new Error('revenuecat_invalid_event');
  const ids = [event.app_user_id, event.original_app_user_id];
  for (const key of ['aliases', 'transferred_from', 'transferred_to', 'redeemed_by']) {
    const values = event[key];
    if (Array.isArray(values)) ids.push(...values);
  }
  return {
    id: event.id,
    type: event.type,
    eventAt: event.event_timestamp_ms,
    appUserIds: [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id))],
  };
}

export async function verifyRevenueCatSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now: number
): Promise<boolean> {
  const match = header?.match(/^t=(\d+),v1=([a-f0-9]{64})$/i);
  if (!match || !secret || Math.abs(now / 1000 - Number(match[1])) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signature = Uint8Array.from(match[2].match(/../g)!, (hex) => Number.parseInt(hex, 16));
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(`${match[1]}.${rawBody}`)
  );
}
