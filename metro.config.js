const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Node < 18.17 lacks os.availableParallelism; Metro expects it.
if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => (os.cpus() ? os.cpus().length : 1);
}

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  buffer: require.resolve('buffer'),
};

// Groth16 vote flow needs to load:
//   - .dat (cpp witnesscalc binary descriptor, assets/circuits/query_identity.dat)
//   - .zkey (Groth16 zkey — too big to bundle, downloaded at runtime)
// CSCA bootstrap (utils/icao-master-tree.ts) needs:
//   - .pem (ICAO master list bundle, assets/certificates/master_000316.pem)
// None are in Metro's default assetExts, so require() of these files would
// throw "Unable to resolve module" without this.
config.resolver.assetExts = [...config.resolver.assetExts, 'zkey', 'dat', 'pem'];

const expoGoMocks =
  process.env.EXPO_GO_MOCKS === '1' || process.env.EXPO_PUBLIC_EXPO_GO_MOCKS === '1';
const expoGoMockPath = 'mocks/expo-go.js';
const expoGoMockModules = new Set([
  'react-native-nfc-manager',
  'react-native-mmkv',
  'react-native-vision-camera',
  'react-native-vision-camera-text-recognition',
  'react-native-worklets-core',
  '@rarimo/rarime-rn-sdk',
  '@rarimo/rarime-rn-sdk/build/helpers/contracts',
  '@/modules/e-document',
  '@modules/rapidsnark-wrp',
  '@modules/witnesscalculator/src/WitnesscalculatorModule',
]);

// Force resolution of packages that don't have React Native exports.
// @iden3/js-crypto only ships browser ESM — point Metro at that bundle so the
// SDK (which imports it transitively from RarimePassport / Rarime.ts) works
// without an "Unable to resolve module" error at app start.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (expoGoMocks && expoGoMockModules.has(moduleName)) {
    return { filePath: path.resolve(__dirname, expoGoMockPath), type: 'sourceFile' };
  }

  if (moduleName === '@iden3/js-crypto') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/@iden3/js-crypto/dist/browser/esm/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
