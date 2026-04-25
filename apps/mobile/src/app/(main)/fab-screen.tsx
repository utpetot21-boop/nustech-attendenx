import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function FabScreen() {
  useEffect(() => { router.replace('/(main)/attendance'); }, []);
  return <View />;
}
