import { Redirect } from 'expo-router';

/** Compatibility for old links; notification consent is now a modal on Home. */
export default function LegacyTrialNotifications() {
  return <Redirect href="/(tabs)/dashboard" />;
}
