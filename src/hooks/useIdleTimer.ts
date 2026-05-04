import {useCallback, useEffect, useRef} from 'react';
import {AppState, PanResponder, type AppStateStatus} from 'react-native';

/**
 * Resets idle timer on any touch (legacy resetIdleTimer parity).
 */
export function useIdleTimer(
  timeoutMs: number,
  onIdle: () => void,
): {panHandlers: ReturnType<typeof PanResponder.create>['panHandlers']} {
  const deadline = useRef(Date.now() + timeoutMs);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const schedule = useCallback(() => {
    deadline.current = Date.now() + timeoutMs;
  }, [timeoutMs]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() > deadline.current) {
        onIdle();
        schedule();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [onIdle, schedule]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        schedule();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [schedule]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        schedule();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        schedule();
        return false;
      },
    }),
  );

  return {panHandlers: panResponder.current.panHandlers};
}
