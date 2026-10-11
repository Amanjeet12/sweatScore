type Member = { isAdmin?: boolean; isPremium?: boolean; onboarded?: boolean } | null;
type Billing = { status: string; expiresAt?: number } | null;

/** Preserve completed legacy paid accounts only until their first billing result. */
export function hasMemberPremiumAccess(member: Member, billing: Billing, now = Date.now()) {
  if (!member) return false;
  if (member.isAdmin) return true;
  // A known inactive/expired result always overrides the old premium flag.
  if (billing)
    return (
      billing.status === 'active' && (billing.expiresAt === undefined || billing.expiresAt > now)
    );
  return member.onboarded === true && member.isPremium === true;
}
