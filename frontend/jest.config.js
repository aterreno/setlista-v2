const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    // Only include components that are actively being tested
    'components/HomeClient.tsx',
    'components/HomeSearchForm.tsx',
    'components/ui/button.tsx',
    'components/ui/input.tsx',
    'components/ui/use-toast.ts',
    'lib/utils.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Add directories/files to exclude from coverage calculations
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'app/',      // Next.js app router files not yet tested
    'pages/',    // Next.js pages not yet tested
    '/components/(?!HomeClient|HomeSearchForm|ui/button|ui/input|ui/use-toast).*' // Ignore components we're not testing yet
  ],
  coverageThreshold: {
    global: {
      branches: 70, // Current average is 74.19%
      functions: 90, // Current average is 93.33%
      lines: 85,     // Current average is 90.67%
      statements: 85 // Current average is 89.43%
    },
    // Set per-file thresholds for files we know have complete coverage
    './components/ui/input.tsx': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './lib/utils.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
