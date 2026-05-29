import React, {createContext, useContext} from 'react';

const KioskIdleActivityContext = createContext<(() => void) | null>(null);

export function KioskIdleActivityProvider({
  resetIdle,
  children,
}: {
  resetIdle: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <KioskIdleActivityContext.Provider value={resetIdle}>
      {children}
    </KioskIdleActivityContext.Provider>
  );
}

/** Call from any `onPress` so the 10s kiosk idle timer restarts. */
export function useKioskIdleActivity(): () => void {
  return useContext(KioskIdleActivityContext) ?? (() => {});
}
