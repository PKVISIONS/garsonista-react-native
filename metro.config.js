const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const resolveRequest = config.resolver.resolveRequest;

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  /**
   * Metro parses `@theme/kiosk` as a scoped package id (see `parseBareSpecifier`
   * in metro-resolver). Map it so `package.json` `"main": "kiosk.ts"` applies.
   */
  '@theme/kiosk': path.resolve(__dirname, 'src/theme'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@theme/kiosk') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/theme/kiosk.ts'),
    };
  }
  if (resolveRequest) {
    return resolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
