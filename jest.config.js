module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@models$': '<rootDir>/src/models/index.ts',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services$': '<rootDir>/src/services/index.ts',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store$': '<rootDir>/src/stores/index.ts',
    '^@store/(.*)$': '<rootDir>/src/stores/$1',
    '^@screens/(.*)$': '<rootDir>/src/components/screens/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@theme/kiosk$': '<rootDir>/src/theme/kiosk.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
