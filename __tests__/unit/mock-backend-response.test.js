const path = require('path');

const {mockBackendResponse} = require('../../src/mock-backend-response');

describe('Render Backend Response', () => {
	const directory = path.resolve(__dirname, 'mock-files');

	const options = {
		key: 'testResponse',
		directory: directory
	};
	let next;

	beforeEach(() => {
		process.env.NODE_ENV = 'test';
		next = jest.fn();
	});

	test('returns a middleware function', () => {
		const middleware = mockBackendResponse(options);

		expect(middleware).toBeInstanceOf(Function);
	});

	test('does not allow use in production', () => {
		process.env.NODE_ENV = 'production';

		expect(() => mockBackendResponse(options)).toThrow('Mocking can not be enabled in a production environment');
	});

	test('calls next if request is not GET or POST', () => {
		const middleware = mockBackendResponse(options);

		middleware({
			method: 'head',
			path: '/a/url'
		}, undefined, next);

		expect(next).toHaveBeenCalledWith();
		expect(next.mock.calls[0].length).toEqual(0);
	});

	test('calls next if request does not match any mock files', () => {
		const middleware = mockBackendResponse(options);

		middleware({
			method: 'get',
			path: '/does/not/exist'
		}, undefined, next);

		expect(next).toHaveBeenCalledWith();
		expect(next.mock.calls[0].length).toEqual(0);
	});

	test.each([
		['get', '/', 'get.json'],
		['post', '/', 'post.json'],
		['get', '/js', 'js-get.js'],
		['get', 'js', 'js-get.js'],
		['get', 'duplicate', 'duplicate-get.js'],
		['get', 'sub-directory', 'sub-directory-get.json'],
		['get', 'sub-directory/', 'sub-directory/get.js'],
		['get', '/sub-directory/', 'sub-directory/get.js'],
		['get', 'sub-directory/file', 'sub-directory/file-get.json']
	])('mocks HTTP %s "%s" with file %s', (httpMethod, path, file) => {
		const middleware = mockBackendResponse(options);
		const request = {
			method: httpMethod,
			path
		};

		middleware(request, undefined, next);

		expect(next).toHaveBeenCalledWith();
		expect(request.testResponse).toEqual({
			file
		});
	});

	test('surfaces the error if the included file causes a runtime exception', () => {
		const middleware = mockBackendResponse(options);

		expect(() => {
			middleware({
				method: 'get',
				path: 'runtime-error'
			}, undefined, next);
		}).toThrow('Unhandled error');
		expect(next).toHaveBeenCalledTimes(0);
	});
});
