import { defineConfig } from 'eslint/config';
import { configs } from '@croct/eslint-plugin';

export default defineConfig(
    configs.react,
    configs.typescript,
    {
        ignores: [
            'build/**',
            'node_modules/**',
            'dist/',
            '.snapshots/',
            '*.min.js',
        ],
        rules: {
            'import/no-default-export': 'off',
            'no-console': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
        },
    },
    {
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
            jest: {
                version: 'detect',
            },
        },
    },
);
