import { createContext, useContext } from 'react';
import { Animated } from 'react-native';

interface TabBarCtx {
  translateY: Animated.Value;
  onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void;
  showTabBar: () => void;
}

export const TabBarContext = createContext<TabBarCtx>({
  translateY: new Animated.Value(0),
  onScroll: () => {},
  showTabBar: () => {},
});

export const useTabBar = () => useContext(TabBarContext);
