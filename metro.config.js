const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (needed for ppu-paddle-ocr subpaths)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
