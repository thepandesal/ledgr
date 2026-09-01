const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable package.json `exports` field resolution (needed for ppu-paddle-ocr subpaths)
config.resolver.unstable_enablePackageExports = true;

// Force single instances to prevent duplicate module TDZ/M_ID errors on web
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query'),
};

module.exports = config;
