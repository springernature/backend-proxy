const fs = require('fs');
const path = require('path');

const {MiddlewareError} = require('./middleware-error');

const defaultOptions = {
	key: 'backendResponse'
};

/**
 *	Express middleware that will mimic {@link backendProxy}.
 * 	For every request the mockDirectory will be searched for a JSON file matching the request URL.
 * 	When found that will be stored on the express request.
 *
 * @param {object} options - Configuration options
 * @param {String} options.directory - Directory to serve files from
 * @param {String} [options.key=backendResponse] - The property name that the backend response is stored at
 * @returns {Function} - Express middleware
 */
function mockBackendResponse(options) {
	if (process.env.NODE_ENV === 'production') {
		throw new Error('Mocking can not be enabled in a production environment');
	}

	options = {
		...defaultOptions,
		...options
	};

	return (request, response, next) => {
		const baseFilename = path.join(options.directory, request.url);
		const method = request.method.toLowerCase();
		const filename = `${baseFilename}_${method}.json`;

		// Only intercept GET & POST requests.
		if (method !== 'get' && method !== 'post') {
			return next();
		}

		fs.readFile(filename, (error, data) => {
			if (error) {
				return next();
			}

			try {
				request[options.key] = JSON.parse(data.toString());
				next();
			} catch (error_) {
				const parseError = new MiddlewareError(`Error de-serialising mock response using file ${filename}`);
				parseError.original = error_;

				next(parseError);
			}
		});
	};
}

module.exports = {mockBackendResponse};
