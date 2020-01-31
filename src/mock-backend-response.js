const path = require('path');

const defaultOptions = {
	key: 'backendResponse'
};

/**
 *	Express middleware that will mimic {@link backendProxy}.
 * 	For every request the mockDirectory will be searched for a JSON file matching the request URL.
 * 	When found that will be stored on the express request.
 *
 * @param {object} options - Configuration options
 * @param {string} options.directory - Directory to serve files from
 * @param {string} [options.key=backendResponse] - The property name that the backend response is stored at
 * @returns {function} - Express middleware
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
		const method = request.method.toLowerCase();

		// Only intercept GET & POST requests.
		if (method !== 'get' && method !== 'post') {
			return next();
		}

		// If the request was to '/', then we don't want the filename to have to be '-get.json', but rather 'get.json'
		const separator = request.path.endsWith('/') ? '' : '-';
		const filename = `${request.path}${separator}${method}`;
		const fullFilename = path.join(options.directory, filename);

		try {
			// Resolve the filename to a full path. This throws an exception if no file (js or json) could be located
			const resolvedFile = require.resolve(fullFilename);
			// Clear the cache for that entry, so we don't get stale data
			delete require.cache[resolvedFile];

			const mockResponse = require(resolvedFile);

			if (typeof mockResponse === 'function') {
				request[options.key] = mockResponse(request);
			} else {
				request[options.key] = mockResponse;
			}

			next();
		} catch (error) {
			if (error.code === 'MODULE_NOT_FOUND') {
				// Swallow the error as it was caused by there being no file
				return next();
			}
			throw error;
		}
	};
}

module.exports = {mockBackendResponse};
