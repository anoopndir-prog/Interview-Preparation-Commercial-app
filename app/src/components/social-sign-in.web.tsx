import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrDivider } from './social-sign-in-divider';

import { Spacing } from '@/constants/theme';
import { api, asApiError } from '@/lib/api';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client).
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let gisLoader: Promise<void> | null = null;
function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoader = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return gisLoader;
}

interface Props {
  onSignedIn: (token: string) => Promise<void>;
  onError: (message: string) => void;
}

/**
 * Web: Google's official "Continue with Google" button via Google Identity Services.
 * (Sign in with Apple on the web needs an Apple Services ID; it is iOS-only for now.)
 */
export function SocialSignIn({ onSignedIn, onError }: Props) {
  const container = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const handlers = useRef({ onSignedIn, onError });

  useEffect(() => {
    handlers.current = { onSignedIn, onError };
  }, [onSignedIn, onError]);

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID || !width) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then(() => {
        const element = container.current as unknown as HTMLElement | null;
        if (cancelled || !element || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              const { token } = await api.googleSignIn(credential);
              await handlers.current.onSignedIn(token);
            } catch (err) {
              handlers.current.onError(asApiError(err).message);
            }
          },
        });
        window.google.accounts.id.renderButton(element, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.max(200, Math.min(400, Math.round(width))),
        });
      })
      .catch((err: Error) => handlers.current.onError(err.message));
    return () => {
      cancelled = true;
    };
  }, [width]);

  if (!GOOGLE_WEB_CLIENT_ID) return null;

  return (
    <View style={styles.wrap}>
      <View ref={container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.button} />
      <OrDivider />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 2 },
  button: { minHeight: 44, alignItems: 'center' },
});
