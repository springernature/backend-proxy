const EventEmitter = require('events');
const {request} = require('http');

jest.mock('http');

const {backendProxy} = require('../../src/backend-proxy');

describe('Backend Proxy', () => {
	const baseOptions = {
		backend: 'http://backend.local',
		requiredContentType: 'application/my-content-type',
		key: 'testResponse',
		usePath: true
	};

	let mockRequest;
	let mockResponse;
	let next;
	let proxyRequest;
	let backendResponse;
	let response;

	beforeEach(() => {
		proxyRequest = new EventEmitter();
		proxyRequest.pipe = jest.fn();

		mockRequest = {
			pipe: jest.fn().mockReturnValueOnce(proxyRequest),
			url: '/some/path',
			method: 'PATCH',
			headers: {
				'some-header': 'header-value'
			}
		};

		mockResponse = {};

		next = jest.fn();

		backendResponse = new EventEmitter();
		backendResponse.pipe = jest.fn();
		backendResponse.headers = {
			'content-type': baseOptions.requiredContentType
		};
		backendResponse.statusCode = 200;

		response = {
			header: jest.fn(),
			set: jest.fn()
		};
	});

	afterEach(() => {
		request.mockReset();
	});

	test('creates a middleware function', () => {
		// When
		const middleware = backendProxy(baseOptions);

		// Then
		expect(middleware).toBeInstanceOf(Function);
	});

	test('does not proxy a request when backendResponse already exists', () => {
		// Given
		const middleware = backendProxy(baseOptions);
		mockRequest[baseOptions.key] = true;

		// When
		middleware(mockRequest, mockResponse, next);

		// Then
		expect(next).toHaveBeenCalledTimes(1);
		expect(mockRequest.pipe).not.toHaveBeenCalled();
	});

	test('pipes the request through to the backend', () => {
		// Given
		const middleware = backendProxy(baseOptions);
		mockRequest.pipe.mockReturnValueOnce({
			on: jest.fn()
		});
		mockRequest.headers = {
			...mockRequest.headers,
			host: 'original.host:8080'
		};

		// When
		middleware(mockRequest, mockResponse, next);

		// Then
		expect(mockRequest.pipe).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledWith(expect.objectContaining({
			hostname: 'backend.local',
			path: mockRequest.url,
			method: mockRequest.method,
			headers: {
				...mockRequest.headers,
				host: 'backend.local',
				'X-Orig-Host': 'original.host:8080'
			}
		}));
		// We haven't simulated an error or a response so next should not have been called at this point
		expect(next).not.toHaveBeenCalled();
	});

	test(`pipes the request to the backend without the incoming path when usePath is false`, () => {
		// Given
		const middleware = backendProxy({
			...baseOptions,
			usePath: false,
			backend: 'http://backend.local/sub/path'
		});
		mockRequest.pipe.mockReturnValueOnce({
			on: jest.fn()
		});

		// When
		middleware(mockRequest, mockResponse, next);

		// Then
		expect(request).toHaveBeenCalledWith(expect.objectContaining({
			hostname: 'backend.local',
			path: '/sub/path',
			method: mockRequest.method,
			headers: mockRequest.headers
		}));
		// We haven't simulated an error or a response so next should not have been called at this point
		expect(next).not.toHaveBeenCalled();
	});

	describe('backend response', () => {
		test('passes an error on to next', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			middleware(mockRequest, mockResponse, next);
			const error = {code: 'some error'};

			// When
			proxyRequest.emit('error', error);

			// Then
			expect(next).toHaveBeenCalledWith(error);
		});

		test('pipes a backend response to the client when the content-type is not correct', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			backendResponse.headers = {
				'content-type': 'not-the-right-one',
				'dummy-header': 'dummy-value'
			};

			middleware(mockRequest, response, next);

			// When
			proxyRequest.emit('response', backendResponse);

			// Then
			expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
			expect(backendResponse.pipe).toHaveBeenCalledWith(response);
			expect(response.header).toHaveBeenCalledWith(backendResponse.headers);
			expect(response.statusCode).toBe(backendResponse.statusCode);
			expect(next).not.toHaveBeenCalled();
		});

		test('pipes a backend response to the client when there is no content type', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			backendResponse.headers = {
				'dummy-header': 'dummy-value'
			};

			middleware(mockRequest, response, next);

			// When
			proxyRequest.emit('response', backendResponse);

			// Then
			expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
			expect(backendResponse.pipe).toHaveBeenCalledWith(response);
			expect(response.header).toHaveBeenCalledWith(backendResponse.headers);
			expect(response.statusCode).toBe(backendResponse.statusCode);
			expect(next).not.toHaveBeenCalled();
		});

		test('processes the backend response, storing it on the request object', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			const backendBody = {
				field1: 'value1',
				field2: 'value2',
				field3: 'value3',
				field4: 'value4'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);
			backendResponse.statusCode = 200;

			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(mockResponse.statusCode).toEqual(200);
			expect(mockRequest[baseOptions.key]).toEqual(backendBody);
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('supplements, the outgoing HTTP response headers with headers name from backendHeaders option', () => {
			// Given
			const middleware = backendProxy({
				...baseOptions,
				backendHeaders: [
					'dummy-header',
					'dummy-header2'
				]
			});

			backendResponse.headers = {
				'content-type': `${baseOptions.requiredContentType.toUpperCase()}; charset=utf-8`,
				'dummy-header': 'dummy-value',
				'dummy-header2': 'dummy-value2'
			};

			const backendBody = {
				field1: 'value1'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, response, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(response.set).toHaveBeenCalledTimes(2);
			expect(response.set).toHaveBeenCalledWith('dummy-header', 'dummy-value');
			expect(response.set).toHaveBeenCalledWith('dummy-header2', 'dummy-value2');
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('do not supplements, the outgoing HTTP response headers with headers if the backend response has no headers', () => {
			// Given
			const middleware = backendProxy({
				...baseOptions,
				backendHeaders: ['dummy-header']
			});

			const backendBody = {
				field1: 'value1'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, response, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(response.set).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('do not supplements, the outgoing HTTP response headers with headers if the backendHeaders option is not an Array', () => {
			// Given
			const middleware = backendProxy({
				...baseOptions,
				backendHeaders: 'dummy-header'
			});

			const backendBody = {
				field1: 'value1'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, response, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(response.set).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('processes a utf-8 backend response (case insensitive), storing it on the request object', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			backendResponse.headers = {
				'content-type': `${baseOptions.requiredContentType.toUpperCase()}; charset=utf-8`
			};

			const backendBody = {
				field1: 'value1'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(mockRequest[baseOptions.key]).toEqual(backendBody);
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('reads the backend response and catches invalid JSON', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			const parts = ['definitely', 'not', '{};; json'];

			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(next).toHaveBeenCalledWith(expect.objectContaining({
				statusCode: 500,
				message: expect.stringContaining('Unexpected token')
			}));
		});

		test('catches an error reading the backend stream', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			backendResponse.emit('error', new Error('stream error'));

			// Then
			expect(next).toHaveBeenCalledWith(new Error('stream error'));
		});

		test('catches the backend stream being aborted', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			backendResponse.emit('aborted');

			// Then
			expect(next).toHaveBeenCalledWith(new Error('Stream was aborted before the response could be read'));
		});

		test('catches the backend stream being closed', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			middleware(mockRequest, mockResponse, next);
			proxyRequest.emit('response', backendResponse);

			// When
			backendResponse.emit('close');

			// Then
			expect(next).toHaveBeenCalledWith(new Error('Stream was closed before the response could be read'));
		});

		describe('when the stream gets aborted', () => {
			test('does not call next when the stream is then closed', () => {
				// Given
				const middleware = backendProxy(baseOptions);
				middleware(mockRequest, mockResponse, next);
				proxyRequest.emit('response', backendResponse);

				// When
				backendResponse.emit('aborted');
				backendResponse.emit('close');

				// Then
				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith(new Error('Stream was aborted before the response could be read'));
			});
		});

		describe('when the backend responds with a server error', () => {
			let middleware;

			beforeEach(() => {
				middleware = backendProxy({
					...baseOptions
				});

				middleware(mockRequest, response, next);

				backendResponse.headers = {};
			});

			test.each(
				[500, 599]
			)('intercepts a %s request and raises it as an express error', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).not.toHaveBeenCalled();
				expect(response.header).not.toHaveBeenCalledWith();
				expect(response.statusCode).toBe(statusCode);
				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith({
					statusCode: statusCode
				});
			});
		});

		describe('when the backend responds with a client error', () => {
			let middleware;

			beforeEach(() => {
				middleware = backendProxy({
					...baseOptions
				});

				middleware(mockRequest, response, next);

				backendResponse.headers = {};
			});

			test.each(
				[400, 401, 404, 418]
			)('intercepts a %s request and proxies it to the client', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalled();
				expect(response.header).toHaveBeenCalledWith({...backendResponse.headers});
				expect(response.statusCode).toBe(statusCode);
				expect(next).not.toHaveBeenCalled();
				expect(response.statusCode).toBe(backendResponse.statusCode);
			});
		});

		describe('when interceptErrors is passed as `true` and the backend responds with a error', () => {
			let middleware;

			beforeEach(() => {
				middleware = backendProxy({
					...baseOptions,
					interceptErrors: true
				});

				middleware(mockRequest, response, next);

				backendResponse.headers = {};
			});

			test.each(
				[400, 404, 500, 599]
			)('intercepts a %s request and raises it as an express error', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).not.toHaveBeenCalled();
				expect(response.header).not.toHaveBeenCalledWith();
				expect(response.statusCode).toBe(statusCode);
				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith({
					statusCode: statusCode
				});
			});
		});

		describe('when interceptErrors is passed as `false` and the backend responds with a error', () => {
			let middleware;

			beforeEach(() => {
				middleware = backendProxy({
					...baseOptions,
					interceptErrors: false
				});

				middleware(mockRequest, response, next);

				backendResponse.headers = {};
			});

			test.each(
				[400, 404, 500, 599]
			)('intercepts a %s request and raises it as an express error', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalled();
				expect(response.header).toHaveBeenCalledWith({...backendResponse.headers});
				expect(response.statusCode).toBe(statusCode);
				expect(next).not.toHaveBeenCalled();
				expect(response.statusCode).toBe(backendResponse.statusCode);
			});
		});

		describe('when interceptErrors is passed as a `function` and the backend responds with a error', () => {
			let middleware;
			const errorsToPipeToFrontend = [404, 500];
			const errorsToIntercept = [401, 501];

			beforeEach(() => {
				middleware = backendProxy({
					...baseOptions,
					interceptErrors: backendResponse => errorsToIntercept.includes(backendResponse.statusCode)
				});

				middleware(mockRequest, response, next);

				backendResponse.headers = {};
			});

			test.each(
				errorsToIntercept
			)('intercepts a %s request and raises it as an express error', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).not.toHaveBeenCalled();
				expect(response.header).not.toHaveBeenCalledWith();
				expect(response.statusCode).toBe(statusCode);
				expect(next).toHaveBeenCalledTimes(1);
				expect(next).toHaveBeenCalledWith({
					statusCode: statusCode
				});
			});

			test.each(
				errorsToPipeToFrontend
			)('intercepts a %s request and proxies it to the client', statusCode => {
				// Given
				backendResponse.statusCode = statusCode;

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalled();
				expect(response.header).toHaveBeenCalledWith({...backendResponse.headers});
				expect(response.statusCode).toBe(statusCode);
				expect(next).not.toHaveBeenCalled();
				expect(response.statusCode).toBe(backendResponse.statusCode);
			});
		});

		describe('redirect', () => {
			let middleware;

			const relativeLocation = `/some-wonderful/location?here=there#my-id`;

			beforeEach(() => {
				middleware = backendProxy(baseOptions);

				backendResponse.headers = {
					location: baseOptions.backend + relativeLocation
				};
				backendResponse.statusCode = 302;
			});

			test('forwards a 399 backend response with a rewritten location if the location header is to the backend server', () => {
				// Given
				backendResponse.statusCode = 399;
				middleware(mockRequest, response, next);

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
				expect(backendResponse.pipe).toHaveBeenCalledWith(response);
				expect(response.header).toHaveBeenCalledWith({
					...backendResponse.headers,
					location: relativeLocation
				});
				expect(response.statusCode).toBe(backendResponse.statusCode);
				expect(next).not.toHaveBeenCalled();
			});

			test('forwards a 300 backend response with a rewritten location if the location header is to the backend server', () => {
				// Given
				middleware(mockRequest, response, next);

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
				expect(backendResponse.pipe).toHaveBeenCalledWith(response);
				expect(response.header).toHaveBeenCalledWith({
					...backendResponse.headers,
					location: relativeLocation
				});
				expect(response.statusCode).toBe(backendResponse.statusCode);
				expect(next).not.toHaveBeenCalled();
			});

			test(`forwards a 30x backend response without change if there is no location header`, () => {
				// Given
				middleware(mockRequest, response, next);

				// Given
				backendResponse.headers = {
					'content-type': 'text/plain'
				};

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
				expect(backendResponse.pipe).toHaveBeenCalledWith(response);
				expect(response.header).toHaveBeenCalledWith(backendResponse.headers);
				expect(response.statusCode).toBe(backendResponse.statusCode);
				expect(next).not.toHaveBeenCalled();
			});

			test('rewrites the location header if the domain matches the backend domain, but not the backend path', () => {
				// Given
				const middleware = backendProxy({
					...baseOptions,
					backend: baseOptions.backend + '/additional/path'
				});

				middleware(mockRequest, response, next);

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
				expect(backendResponse.pipe).toHaveBeenCalledWith(response);
				expect(response.header).toHaveBeenCalledWith({
					...backendResponse.headers,
					location: relativeLocation
				});
				expect(response.statusCode).toBe(backendResponse.statusCode);
				expect(next).not.toHaveBeenCalled();
			});

			test(`forwards a 30x redirect with no changes to the location header`, () => {
				// Given
				backendResponse.headers = {
					location: 'http://not.the-back.end/some-wonderful/location?here=there#my-id'
				};
				middleware(mockRequest, response, next);

				// When
				proxyRequest.emit('response', backendResponse);

				// Then
				expect(backendResponse.pipe).toHaveBeenCalledTimes(1);
				expect(backendResponse.pipe).toHaveBeenCalledWith(response);
				expect(response.header).toHaveBeenCalledWith(backendResponse.headers);
				expect(response.statusCode).toBe(backendResponse.statusCode);
				expect(next).not.toHaveBeenCalled();
			});
		});
	});
});
