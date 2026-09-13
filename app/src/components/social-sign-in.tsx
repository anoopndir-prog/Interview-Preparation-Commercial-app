import { GoogleSignin, GoogleSigninButton, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { OrDivider } from './social-sign-in-divider';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { api, asApiError } from '@/lib/api';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// The ID token's audience is the *web* client ID, which is what the server verifies.
if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
}

interface Props {
  onSignedIn: (token: string) => Promise<void>;
  onError: (message: string) => void;
}

/** "Continue with Apple" (iOS) and "Continue with Google" buttons, followed by an "or" divider. */
export function SocialSignIn({ onSignedIn, onError }: Props) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => undefined);
  }, []);

  const withGoogle = async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return; // user closed the sheet
      if (!res.data.idToken) throw new Error('Google did not return an ID token. Check the Google client IDs.');
      const { token } = await api.googleSignIn(res.data.idToken);
      await onSignedIn(token);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) return;
      onError(asApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const withApple = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
      // Apple shares the name only on the first sign-in, so pass it along now.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      const { token } = await api.appleSignIn(credential.identityToken, fullName);
      await onSignedIn(token);
    } catch (err) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      onError(asApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (!GOOGLE_WEB_CLIENT_ID && !appleAvailable) return null;

  return (
    <View style={styles.wrap}>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radius.md}
          style={styles.apple}
          onPress={withApple}
        />
      )}
      {GOOGLE_WEB_CLIENT_ID && (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          onPress={withGoogle}
          disabled={busy}
          style={styles.google}
        />
      )}
      {busy && <ActivityIndicator color={Brand.blue} />}
      <OrDivider />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 2 },
  apple: { height: 50, width: '100%' },
  google: { height: 52, width: '100%' },
});
