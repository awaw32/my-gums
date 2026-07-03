export default [
  { ignores: ['node_modules/', 'assets/', 'tests/'] },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        fetch: 'readonly', alert: 'readonly', console: 'readonly',
        setTimeout: 'readonly', setInterval: 'readonly',
        requestAnimationFrame: 'readonly', clearTimeout: 'readonly'
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
        require: 'readonly', module: 'readonly', __dirname: 'readonly',
        process: 'readonly', Buffer: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly'
      }
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error', 'no-console': 'off' }
  }
];
