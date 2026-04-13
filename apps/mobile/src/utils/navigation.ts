/**
 * Navigation deep-link utilities (React Native only)
 */
import { Linking, Platform } from 'react-native';

export async function openGoogleMapsNavigation(lat: number, lng: number): Promise<void> {
  const url = Platform.select({
    ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    android: `google.navigation:q=${lat},${lng}&mode=d`,
  }) ?? `https://maps.google.com/?q=${lat},${lng}&navigate=yes`;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Linking.openURL(`https://maps.google.com/?q=${lat},${lng}&navigate=yes`);
  }
}

export async function openWazeNavigation(lat: number, lng: number): Promise<void> {
  const url = `waze://ul?ll=${lat},${lng}&navigate=yes`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    await Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
  }
}
