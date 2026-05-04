/**
 * Garsonista Kiosk — full RN refactor scaffold (all phases).
 */

import './src/services';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {theme} from '@theme/kiosk';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {localizationStore} from './src/stores/Localization/LocalizationStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {retry: 1},
  },
});

/**
 * Cordova `w3.css` / `main.css` body: `Averta` (RN: `Averta-Regular` + bold/semibold TTFs).
 * `defaultProps` is valid on `Text` at runtime; typings omit it in recent RN+React.
 */
const avertaBase = {fontFamily: theme.font.regular};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAvertaTextDefaults(): void {
  const T = Text as any;
  const TI = TextInput as any;
  T.defaultProps = {
    ...T.defaultProps,
    style: StyleSheet.flatten([T.defaultProps?.style, avertaBase]) ?? avertaBase,
  };
  TI.defaultProps = {
    ...TI.defaultProps,
    style: StyleSheet.flatten([TI.defaultProps?.style, avertaBase]) ?? avertaBase,
  };
}
applyAvertaTextDefaults();

function App(): React.JSX.Element {
  const [localizationReady, setLocalizationReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void localizationStore.start().finally(() => {
      if (mounted) {
        setLocalizationReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={theme.color.bgPrimary} />
          {localizationReady ? (
            <AppNavigator />
          ) : (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={theme.color.accentPrimary} />
            </View>
          )}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.color.bgPrimary},
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgPrimary,
  },
});
