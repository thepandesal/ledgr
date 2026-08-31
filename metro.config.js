const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (needed for ppu-paddle-ocr subpaths)
config.resolver.unstable_enablePackageExports = true;

// Force single instances of react and react-query to prevent duplicate module errors (M_ID / TDZ)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName === 'react-dom') {
    return { filePath: path.resolve(__dirname, `node_modules/${moduleName}/index.js`), type: 'sourceFile' };
  }
  if (moduleName === '@tanstack/react-query') {
    return { filePath: path.resolve(__dirname, 'node_modules/@tanstack/react-query/build/modern/index.js'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
