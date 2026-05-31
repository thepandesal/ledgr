import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: Check Supabase auth session
  const isAuthenticated = false;

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/spaces" />;
  }

  return <Redirect href="/login" />;
}
