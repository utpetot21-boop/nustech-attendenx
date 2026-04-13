/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    '../../.eslintrc.js',
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  root: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@next/next/no-img-element': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
  ignorePatterns: ['.next/', 'node_modules/'],
};
