module.exports = {
	env: {
		es6: true,
		node: true,
		jest: true,
	},
	parser: 'babel-eslint',
	parserOptions: {
		ecmaVersion: 6,
		ecmaFeatures: {
			'experimentalObjectRestSpread': true
		}
	},
	extends: [
		'@springernature/eslint-config',
		'@springernature/eslint-config/node',
		'@springernature/eslint-config/jest'
	]
};
