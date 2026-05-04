/* eslint-env jest */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(() => undefined),
    remove: jest.fn(),
  })),
}));
