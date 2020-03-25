const http = require('http');
const url = require('url');

const {MiddlewareError} = require('./middleware-error');

const keepAliveAgent = new http.Agent({keepAlive: true});

const defaultOptions = {
	key: 'backendResponse',
	usePath: true,
	requiredContentType: 'application/json',
	changeHost: false,
	interceptErrors: false
};

function tryReadData(options, backendResponse, request, next) {
	const stringBody = [];
	// Read the backend response off in chunks then deserialize it
	backendResponse.on('data', chunk => stringBody.push(chunk));
	backendResponse.on('end', () => {
		try {
			// Supplement req with data from BE
			request[options.key] = JSON.parse(Buffer.concat(stringBody).toString('utf8'));
		} catch (error) {
			return next(new MiddlewareError(error));
		}

		next();
	});

	// let abortHandled = false;
	// response.on('aborted', () => {
	// 	// const bytesRead = stringBody.reduce((total, buffer) => total + buffer.length, 0);
	// 	// abortHandled = true;
	//
	// 	// if (backendResponse.headers['content-length'] === bytesRead) {
	// 	// 	// Try decode the response anyway as we have manage to finish reading
	// 	// 	next();
	// 	// } else {
	// 	// 	next(new MiddlewareError('Socket was closed before the response could be read'));
	// 	// }
	// });
	//
	// response.on('close', () => {
	// 	if (!abortHandled) {
	// 		// it were not an abort
	// 		resolve();
	// 		return;
	// 	}
	//
	// 	reject(new MiddlewareError('Socket was closed before the backend response had finished being read'));
	// });

	backendResponse.on('error', error => {
		next(error);
	});
}

function createHandler({request, response, next, options, backendHttpOptions}) {
	return backendResponse => {
		const contentType = (backendResponse.headers['content-type'] || '').toLowerCase();

		if (contentType === options.requiredContentType || contentType === `${options.requiredContentType}; charset=utf-8`) {
			return tryReadData(options, backendResponse, request, next);
		}

		// We don't have the correct content-type, usually this is because a backend responded with a redirect
		// or an error
		response.statusCode = backendResponse.statusCode;

		// Should we intercept the error and raise it as an express error
		if (options.interceptErrors && backendResponse.statusCode >= 400 && backendResponse.statusCode <= 599) {
			return next({statusCode: backendResponse.statusCode, backendResponse: backendResponse});
		}

		// If it's a redirect we need to rewrite the URL to be relative (to the frontend)
		if (backendResponse.statusCode >= 300 && backendResponse.statusCode <= 399 && backendResponse.headers.location) {
			if (backendResponse.headers.location.includes(backendHttpOptions.host)) {
				const locationUrl = new url.URL(backendResponse.headers.location);
				backendResponse.headers.location = locationUrl.pathname + locationUrl.search + locationUrl.hash;
			}
		}

		// Proxy the headers and backend response to the client
		response.header(backendResponse.headers);
		backendResponse.pipe(response);
	};
}

/**
 * Proxies all requests to the given backend.
 * When the response matches the configured content-type, the response will be parsed and stored on the request
 * express object.
 * Any responses that do not match the content-type will be passed back to the client.
 *
 * @param {object} options - Configuration options
 * @param {string} options.backend - URL of the backend to proxy requests to
 * @param {string} [options.requiredContentType=application/json] - The backend response content type to store for rendering, defaults to "application/json"
 * @param {boolean} [options.usePath=true] - Append the incoming HTTP request path to the backend URL
 * @param {string} [options.key=backendResponse] - The property name that the backend response is stored at
 * @param {boolean} [options.changeHost=false] - Should the request to the backend have its host field set to the backend url
 * @param {boolean} [options.interceptErrors=false] - Should backend responses with HTTP 400 - 599 be intercepted and raised as express errors
 * @returns {function} - An Express middleware
 */
function backendProxy(options) {
	options = {
		...defaultOptions,
		...options,
		requiredContentType: options.requiredContentType.toLowerCase()
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

		if (options.changeHost) {
			request.headers['X-Orig-Host'] = request.headers.host;
			request.headers.host = backendHttpOptions.host;
		}

		// Pipe the incoming request through to the backend
		const proxiedRequest = request.pipe(http.request(requestOptions));

		const handler = createHandler({request, response, next, options, backendHttpOptions});
		proxiedRequest.on('response', handler);

		proxiedRequest.on('error', error => next(error));
	};
}

module.exports = {backendProxy};
