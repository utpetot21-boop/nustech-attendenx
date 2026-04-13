/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.js'],
  root: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 'error', // lebih ketat di shared
  },
};
