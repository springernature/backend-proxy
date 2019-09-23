const http = require('http');
const url = require('url');

const {MiddlewareError} = require('./middleware-error');

const keepAliveAgent = new http.Agent({keepAlive: true});

const defaultOptions = {
	key: 'backendResponse',
	usePath: true,
	requiredContentType: 'application/json'
};

/**
 * Proxies all requests to the given backend.
 * When the response matches the configured content-type, the response will be parsed and stored on the request
 * express object.
 * Any responses that do not match the content-type will be passed back to the client.
 *
 * @param {object} options - Configuration options
 * @param {String} options.backend - URL of the backend to proxy requests to
 * @param {String} [options.requiredContentType=application/json] - The backend response content type to store for rendering, defaults to "application/json"
 * @param {boolean} [options.usePath=true] - Append the incoming HTTP request path to the backend URL
 * @param {String} [options.key=backendResponse] - The property name that the backend response is stored at
 * @returns {Function} - An Express middleware
 */
function backendProxy(options) {
	options = {
		...defaultOptions,
		...options
	};

	const backendHttpOptions = new url.URL(options.backend);
	const basePath = backendHttpOptions.pathname.replace(/\/$/, '');

	return (request, response, next) => {
		// Check if a backend response has already been added (i.e. from mocks)
		if (request[options.key]) {
			return next();
		}

		const requestOptions = {
			agent: keepAliveAgent,
			host: backendHttpOptions.host,
			hostname: backendHttpOptions.hostname,
			port: backendHttpOptions.port,
			method: request.method,
			headers: request.headers,
			path: options.usePath ? basePath + request.url : backendHttpOptions.pathname
		};

		if (options.host) {
			request.headers.host = options.host;
		}

		// Pipe the incoming request through to the backend
		const proxiedRequest = request.pipe(http.request(requestOptions));

		proxiedRequest.on('response', backendResponse => {
			const contentType = backendResponse.headers['content-type'];
			const lowerCaseContentType = contentType.toLowerCase();

			if (contentType === options.requiredContentType || lowerCaseContentType === `${options.requiredContentType}; charset=utf-8`) {
				const stringBody = [];
				// Read the backend response off in chunks then deserialize it
				backendResponse.on('data', chunk => stringBody.push(chunk));
				backendResponse.on('end', () => {
					try {
						// Supplement req with data from BE
						request[options.key] = JSON.parse(Buffer.concat(stringBody).toString('utf8'));
						next();
					} catch (error) {
						next(new MiddlewareError(error));
					}
				});
			} else {
				// Pipe it back to the client as is
				backendResponse.pipe(response);
			}
		});

		proxiedRequest.on('error', error => {
			next(error);
		});
	};
}

module.exports = {backendProxy};
