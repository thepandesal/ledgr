const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (needed for ppu-paddle-ocr subpaths)
config.resolver.unstable_enablePackageExports = true;

// Resolve @/ alias to project root so Metro uses consistent module IDs
// (prevents duplicate instances of react-query, BlurContext, NavContext etc.)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const resolved = path.resolve(__dirname, moduleName.slice(2));
    return context.resolveRequest(context, resolved, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
