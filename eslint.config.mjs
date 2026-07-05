import globals from "globals";

export default [
  { ignores: ['node_modules/', 'assets/', 'tests/'] },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ImageResolver: 'readonly',
      }
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error', 'no-console': 'off' }
  },
  {
    files: ['server.js', 'server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.node,
      }
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error', 'no-console': 'off' }
  },
  {
    files: ['config/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
      }
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error', 'no-console': 'off' }
  },

];
