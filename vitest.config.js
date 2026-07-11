const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js', 'server/**/*.js'],
      exclude: ['js/audio.js'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: { lines: 70, functions: 65, branches: 60, statements: 70 },
    },
  },
});
