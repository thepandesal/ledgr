const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (needed for ppu-paddle-ocr subpaths)
config.resolver.unstable_enablePackageExports = true;

// Force single React instance — unstable_enablePackageExports can cause react to
// resolve via package exports to a different path than the direct import, creating
// two React instances and the 'co' TDZ error on web.
config.resolver.extraNodeModules = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
};

module.exports = config;
