import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withPodfileProperties } from 'expo/config-plugins';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_FIREBASE_ENABLED !== 'true') return config as ExpoConfig;
  const androidFile = resolve(__dirname, 'google-services.json');
  const iosFile = resolve(__dirname, 'GoogleService-Info.plist');
  if (!existsSync(androidFile) || !existsSync(iosFile)) {
    throw new Error('Firebase opt-in requires mobile/google-services.json and mobile/GoogleService-Info.plist.');
  }
  return withPodfileProperties({
    ...config,
    name: config.name ?? 'Inventory Checker',
    slug: config.slug ?? 'inventory-checker',
    android: { ...config.android, googleServicesFile: androidFile },
    ios: { ...config.ios, googleServicesFile: iosFile },
    plugins: [...(config.plugins ?? []), '@react-native-firebase/app', '@react-native-firebase/messaging'],
  }, result => {
    result.modResults['ios.useFrameworks'] = 'static';
    return result;
  });
};
