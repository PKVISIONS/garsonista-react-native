import {useMemo} from 'react';
import {useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {computeMenuGridLayout} from '@constants/menuGridLayout';

/** Shared menu grid sizing — must match `MenuScreen` sidebar + product column layout. */
export function useMenuGridMetrics(): {
  screenWidth: number;
  windowHeight: number;
  leftRailWidth: number;
  cardWidth: number;
  gridLayout: ReturnType<typeof computeMenuGridLayout>;
} {
  const {width: screenWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const gridLayout = useMemo(
    () =>
      computeMenuGridLayout(
        screenWidth,
        windowHeight,
        insets.top,
        insets.bottom,
      ),
    [screenWidth, windowHeight, insets.top, insets.bottom],
  );

  return {
    screenWidth,
    windowHeight,
    leftRailWidth: gridLayout.leftRailWidth,
    cardWidth: gridLayout.cardWidth,
    gridLayout,
  };
}
