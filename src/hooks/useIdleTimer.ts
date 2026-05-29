import {useCallback, useEffect, useRef} from 'react';
import {AppState, PanResponder, type AppStateStatus} from 'react-native';

/**
 * Kiosk inactivity timer — resets on any touch (legacy `resetIdleTimer`).
 * Attach `panHandlers` + `rootTouchProps` on the app root so Pressables still receive taps.
 */
export function useIdleTimer(
  timeoutMs: number,
  onIdle: () => void,
  enabled: boolean,
): {
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  rootTouchProps: {onTouchStart: () => void};
  resetIdle: () => void;
} {
  const deadline = useRef(Date.now() + timeoutMs);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const onIdleRef = useRef(onIdle);
  const resetIdleRef = useRef<() => void>(() => {});
  onIdleRef.current = onIdle;

  const resetIdle = useCallback(() => {
    if (!enabled) {
      return;
    }
    deadline.current = Date.now() + timeoutMs;
  }, [enabled, timeoutMs]);

  resetIdleRef.current = resetIdle;

  useEffect(() => {
    if (enabled) {
      resetIdle();
    }
  }, [enabled, resetIdle]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = setInterval(() => {
      if (Date.now() > deadline.current) {
        onIdleRef.current();
        deadline.current = Date.now() + timeoutMs;
      }
    }, 250);
    return () => clearInterval(id);
  }, [enabled, timeoutMs]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        resetIdleRef.current();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetIdleRef.current();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onStartShouldSetPanResponder: () => {
        resetIdleRef.current();
        return false;
      },
    }),
  ).current;

  const rootTouchProps = {
    onTouchStart: () => resetIdleRef.current(),
  };

  return {panHandlers: panResponder.panHandlers, rootTouchProps, resetIdle};
}
