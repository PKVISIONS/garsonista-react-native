const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: [path.resolve(__dirname)],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
          '@models': path.resolve(__dirname, 'src/models'),
          '@services': path.resolve(__dirname, 'src/services'),
          '@store': path.resolve(__dirname, 'src/components/store'),
          '@screens': path.resolve(__dirname, 'src/components/screens'),
          '@hooks': path.resolve(__dirname, 'src/hooks'),
          '@navigation': path.resolve(__dirname, 'src/navigation'),
          '@constants': path.resolve(__dirname, 'src/constants'),
          '@utils': path.resolve(__dirname, 'src/utils'),
          /** Metro also needs `metro.config.js` resolveRequest for this import. */
          '@theme/kiosk': path.resolve(__dirname, 'src/theme/kiosk.ts'),
        },
      },
    ],
  ],
};
