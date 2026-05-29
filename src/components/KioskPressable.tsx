import React from 'react';
import {Pressable, type PressableProps} from 'react-native';
import {useKioskIdleActivity} from '../context/KioskIdleActivityContext';

/** `Pressable` that restarts the kiosk idle timer on every press. */
export function KioskPressable({
  onPress,
  onPressIn,
  ...rest
}: PressableProps): React.JSX.Element {
  const bumpIdle = useKioskIdleActivity();

  return (
    <Pressable
      {...rest}
      onPressIn={event => {
        bumpIdle();
        onPressIn?.(event);
      }}
      onPress={event => {
        bumpIdle();
        onPress?.(event);
      }}
    />
  );
}
