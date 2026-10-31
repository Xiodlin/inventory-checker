import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL_KEY = 'inventory-checker.api-url';

// Authentication credentials stay in memory; storage is only for the server preference.
export const storageService = {
  getBaseURL: () => AsyncStorage.getItem(API_URL_KEY),
  setBaseURL: (value: string) => AsyncStorage.setItem(API_URL_KEY, value),
};
