module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: { '@': './src' },
        },
      ],
      // No PII is knowingly logged today, but stripping console.* from
      // production JS bundles closes that door structurally rather than by
      // audit — a future console.log(location)/console.log(user) added
      // during debugging and left in would otherwise ship straight to
      // device logs. console.error/warn are kept so crash-adjacent signal
      // isn't silently lost.
      process.env.NODE_ENV === 'production' && [
        'transform-remove-console',
        { exclude: ['error', 'warn'] },
      ],
    ].filter(Boolean),
  };
};
