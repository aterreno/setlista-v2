module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },
  plugins: [
    'react',
    'react-hooks',
  ],
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  root: true,
  env: {
    node: true,
    browser: true,
    jest: true,
    es6: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['.eslintrc.js', 'build/**/*', 'node_modules/**/*', 'coverage/**/*'],
  rules: {
    // General code quality rules
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'eqeqeq': ['error', 'always'],
    'no-warning-comments': 'error',
    
    // React specific rules
    'react/prop-types': 'off', // TypeScript handles prop types
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/display-name': 'error',
    'react/no-unescaped-entities': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/jsx-no-target-blank': 'error',
    
    // React hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
