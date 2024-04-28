module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['jest-extended/all'],
    testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
