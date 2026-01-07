const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    extraNodeModules: {
      buffer: require.resolve('buffer/'),
      events: require.resolve('events/'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
