import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Inventory Checker',
  slug: config.slug ?? 'inventory-checker',
  plugins: [...(config.plugins ?? []), 'expo-sqlite', 'expo-notifications', 'expo-background-task', 'expo-secure-store', 'expo-sharing'],
});
