/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    '../../.eslintrc.js',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  root: true,
  env: {
    'react-native/react-native': true,
  },
  plugins: ['react', 'react-native'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/react-in-jsx-scope': 'off', // tidak diperlukan di React 17+
    'react-native/no-unused-styles': 'error',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['.expo/', 'node_modules/'],
};
