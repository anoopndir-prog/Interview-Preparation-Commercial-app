import type { ConfigContext, ExpoConfig } from 'expo/config';

const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin';

// Static settings live in app.json. This adds the Google Sign-In plugin only when an
// iOS client ID is configured, because the plugin needs its reversed form as a URL scheme.
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== GOOGLE_PLUGIN);

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    plugins.push([GOOGLE_PLUGIN, { iosUrlScheme: `com.googleusercontent.apps.${id}` }]);
  }

  return { ...config, plugins } as ExpoConfig;
};
