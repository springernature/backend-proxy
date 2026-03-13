// eslint.config.js:
import babelParser from '@babel/eslint-parser';
import { coreConfig, jestConfig } from '@springernature/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';

import globals from 'globals';

export default defineConfig([
	globalIgnores([
		'node_modules/',
		'tests',
		'fe-test',
		'coverage',
		'eslint.config.js',
		'**/*test.js',
		'resources',
	]),
	{
		files: ['**/*.js', '**/*(spec|test).js', '**/mock-files/**/*.js'],
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
			parser: babelParser,
			parserOptions: { requireConfigFile: false },
		},
		extends: [coreConfig],
		rules: {
			'no-param-reassign': 0,
			'prefer-const': 'warn',
			'no-inner-declarations': 0,
			'no-negated-condition': 0,
			'no-unused-vars': ['warn', { args: 'none' }],
			'no-console': 0,
			'jest/valid-expect': 0,
			'spaced-comment': 0,
			'no-trailing-spaces': 0,
			'unicorn/no-array-reduce': 0,
			'unicorn/prefer-module': 'off'
		},
	},
	{
		files: ['**/*(spec|test).js'],
		extends: [jestConfig],
		languageOptions: {
			globals: { ...globals.jest },
		},
	},
]);
