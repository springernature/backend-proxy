jest.mock('fs');

const {mockBackendResponse} = require('../src/mock-backend-response');

describe('Render Backend Response', () => {
	const options = {
		key: 'testResponse',
		directory: 'mocks/directory'
	};

	beforeEach(() => {
		process.env.NODE_ENV = 'test'
	});

	test('returns a middleware function', () => {
		const middleware = mockBackendResponse(options);

		expect(middleware).toBeInstanceOf(Function);
	});

	test('does not allow use in production', () => {
		process.env.NODE_ENV = 'production';

		expect(() => mockBackendResponse(options)).toThrowError('Mocking can not be enabled in a production environment');
	});

	test('calls next if request is not GET or POST', () => {
		const middleware = mockBackendResponse(options);
		const next = jest.fn();

		middleware({
			method: 'head',
			url: '/a/url'
		}, undefined, next);

		expect(next).toHaveBeenCalledWith();
	});

	test('opens a mock file', () => {
		const {readFile} = require('fs');
		const middleware = mockBackendResponse(options);
		const req = {
			method: 'get',
			url: '/a/url'
		};

		middleware(req);

		expect(readFile).toHaveBeenCalledWith(`${options.directory}${req.url}_get.json`, expect.any(Function));
	});

	test('calls next if there was an error opening the file', () => {
		const {__getReadFileCb} = require('fs');
		const middleware = mockBackendResponse(options);
		const req = {
			method: 'get',
			url: '/a/url'
		};
		const next = jest.fn();
		middleware(req, undefined, next);

		__getReadFileCb()({error: 'not found'});

		expect(next).toHaveBeenCalledWith();
	});

	test('deserialises the file and stores it on the request', () => {
		const {__getReadFileCb} = require('fs');
		const middleware = mockBackendResponse(options);
		const req = {
			method: 'get',
			url: '/a/url'
		};
		const next = jest.fn();
		const fileContents = {field1: 'value1'};
		middleware(req, undefined, next);

		__getReadFileCb()(undefined, JSON.stringify(fileContents));

		expect(req[options.key]).toEqual(fileContents);
		expect(next).toHaveBeenCalledWith();
	});

	test('calls next with an error if the file cant be parsed',() => {
		const {__getReadFileCb} = require('fs');
		const middleware = mockBackendResponse(options);
		const req = {
			method: 'get',
			url: '/a/url'
		};
		const next = jest.fn();
		middleware(req, undefined, next);

		__getReadFileCb()(undefined, 'not -\'{123; json');

		expect(next).toHaveBeenCalledWith(expect.objectContaining({
			statusCode: 500,
			message: expect.stringContaining('Error de-serialising mock response')
		}));
	});
});
