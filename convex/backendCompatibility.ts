/** Runtime emergency brake; does not remove APIs or change Coach entitlement checks. */
export const legacyPremiumWritesPaused = () => process.env.LEGACY_PREMIUM_WRITES_PAUSED === 'true';
