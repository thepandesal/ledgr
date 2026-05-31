import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getSession } from '@/services/auth';

// This screen handles OAuth redirects
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const session = await getSession();
        if (session) {
          // Redirect to main app
          router.replace('/../src/app/(app)/workspaces');
        } else {
          // Go back to login
          router.replace('/../src/app/index');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/../src/app/index');
      }
    };

    // Small delay to ensure auth state is updated
    const timer = setTimeout(handleAuthCallback, 500);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
