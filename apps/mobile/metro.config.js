const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

process.env.EXPO_ROUTER_APP_ROOT = 'src/app';

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders ?? []),
  monorepoRoot,
];

// Mobile-local node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force all react imports to mobile's react@19 — prevent root react@18 from leaking in
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');
config.resolver.extraNodeModules = {
  react: path.resolve(mobileNodeModules, 'react'),
  'react/jsx-runtime': path.resolve(mobileNodeModules, 'react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(mobileNodeModules, 'react/jsx-dev-runtime'),
  'react-dom': path.resolve(mobileNodeModules, 'react-dom'),
};

// Intercept ALL react resolutions to guarantee mobile's react@19 is used.
// Must resolve to actual file paths (not directories) for type:'sourceFile'.
const _resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react-dom/')
  ) {
    try {
      const filePath = require.resolve(moduleName, { paths: [mobileNodeModules] });
      return { filePath, type: 'sourceFile' };
    } catch (_) {
      // fall through to default resolver
    }
  }
  if (_resolveRequest) {
    return _resolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules\/.*\/\.codegen.*/,
];

module.exports = withNativeWind(config, { input: './src/global.css' });
