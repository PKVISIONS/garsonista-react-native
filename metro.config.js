const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * `@theme/*` is not a real node_modules package; map it so the bundler resolves
 * before Babel transforms (see babel-plugin-module-resolver alias too).
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    /**
     * Metro parses `@theme/kiosk` as a single scoped package id (see `parseBareSpecifier`
     * in metro-resolver). Map it to this folder so `package.json` `"main": "kiosk.ts"` applies.
     */
    extraNodeModules: {
      '@theme/kiosk': path.resolve(__dirname, 'src/theme'),
    },
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@theme/kiosk') {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'src/theme/kiosk.ts'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
