const EventEmitter = require('events');

jest.mock('http');
const {request} = require('http');

const {backendProxy} = require('../../src/backend-proxy');

describe('Backend Proxy', () => {
	const baseOptions = {
		backend: 'http://backend.local',
		requiredContentType: 'application/my-content-type',
		key: 'testResponse',
		usePath: true
	};

	let mockRequest;
	let next;
	let proxyRequest;

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

		next = jest.fn();
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
		middleware(mockRequest, undefined, next);

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

		// When
		middleware(mockRequest, undefined, next);

		// Then
		expect(mockRequest.pipe).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledWith(expect.objectContaining({
			hostname: 'backend.local',
			path: mockRequest.url,
			method: mockRequest.method,
			headers: mockRequest.headers
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
		middleware(mockRequest, undefined, next);

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

	test(`pipes the request to the backend with the host header changed when changeHost is true`, () => {
		// Given
		const middleware = backendProxy({
			...baseOptions,
			usePath: false,
			backend: 'http://backend.local/sub/path',
			changeHost: true
		});
		mockRequest.headers = {
			host: 'original.host:8080'
		};

		// When
		middleware(mockRequest, undefined, next);

		// Then
		expect(request).toHaveBeenCalledWith(expect.objectContaining({
			hostname: 'backend.local',
			path: '/sub/path',
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

	describe('backend response', () => {
		test('passes an error on to next', () => {
			// Given
			const middleware = backendProxy(baseOptions);
			middleware(mockRequest, undefined, next);
			const error = {code: 'some error'};

			// When
			proxyRequest.emit('error', error);

			// Then
			expect(next).toHaveBeenCalledWith(error);
		});

		test('pipes a backend response to the client when the content-type is not correct', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			const backendResponse = new EventEmitter();
			backendResponse.headers = {
				'content-type': 'not-the-right-one',
				'dummy-header': 'dummy-value'
			};
			backendResponse.statusCode = 302;
			backendResponse.pipe = jest.fn();

			const response = {
				header: jest.fn()
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

			const backendResponse = new EventEmitter();
			backendResponse.headers = {
				'dummy-header': 'dummy-value'
			};
			backendResponse.statusCode = 302;
			backendResponse.pipe = jest.fn();

			const response = {
				header: jest.fn()
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

			const backendResponse = new EventEmitter();
			backendResponse.headers = {
				'content-type': baseOptions.requiredContentType
			};

			const backendBody = {
				field1: 'value1',
				field2: 'value2',
				field3: 'value3',
				field4: 'value4'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, undefined, next);
			proxyRequest.emit('response', backendResponse);

			// When
			parts.forEach(part => backendResponse.emit('data', Buffer.from(part)));
			backendResponse.emit('end');

			// Then
			expect(mockRequest[baseOptions.key]).toEqual(backendBody);
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('processes a utf-8 backend response (case insensitive), storing it on the request object', () => {
			// Given
			const middleware = backendProxy(baseOptions);

			const backendResponse = new EventEmitter();
			backendResponse.headers = {
				'content-type': `${baseOptions.requiredContentType.toUpperCase()}; charset=utf-8`
			};

			const backendBody = {
				field1: 'value1'
			};
			const parts = JSON.stringify(backendBody).match(/.{1,2}/g);

			middleware(mockRequest, undefined, next);
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
			const backendResponse = new EventEmitter();
			backendResponse.headers = {
				'content-type': baseOptions.requiredContentType
			};

			middleware(mockRequest, undefined, next);
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

		describe('redirect', () => {
			let middleware;
			let backendResponse;
			let response;

			const relativeLocation = `/some-wonderful/location?here=there#my-id`;

			beforeEach(() => {
				middleware = backendProxy(baseOptions);

				backendResponse = new EventEmitter();
				backendResponse.statusCode = 300;
				backendResponse.pipe = jest.fn();
				backendResponse.headers = {
					location: baseOptions.backend + relativeLocation
				};
				backendResponse.statusCode = 302;

				response = {
					header: jest.fn()
				};
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
