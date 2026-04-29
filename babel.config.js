module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['module:babel-preset-expo'],
    plugins: ['expo-router/babel', 'nativewind/babel'],
  };
};
