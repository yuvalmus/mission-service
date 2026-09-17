/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  clearMocks: true,
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@dtos/(.*)$': '<rootDir>/src/dtos/$1',
    '^@mappers/(.*)$': '<rootDir>/src/mappers/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@docs/(.*)$': '<rootDir>/src/docs/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts']
};
