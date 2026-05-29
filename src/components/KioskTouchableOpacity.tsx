import React from 'react';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import {useKioskIdleActivity} from '../context/KioskIdleActivityContext';

/** `TouchableOpacity` that restarts the kiosk idle timer on every press. */
export function KioskTouchableOpacity({
  onPress,
  onPressIn,
  ...rest
}: TouchableOpacityProps): React.JSX.Element {
  const bumpIdle = useKioskIdleActivity();

  return (
    <TouchableOpacity
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
