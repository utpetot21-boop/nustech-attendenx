// Custom entry point — harus jalan sebelum expo-notifications di-import
// Suppress expo-notifications Expo Go SDK 53 warning (Android only, dev only)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const _error = console.error.bind(console);
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('expo-notifications') &&
      (args[0].includes('SDK 53') || args[0].includes('removed from Expo Go'))
    ) return;
    _error(...args);
  };
  const _warn = console.warn.bind(console);
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('expo-notifications')
    ) return;
    _warn(...args);
  };
}

import 'expo-router/entry';
