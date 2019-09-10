const http = require('http');
const EventEmitter = require('events');
const Express = require('express');

const {backendProxy} = require('../../src/backend-proxy');

function resolveRejectError(resolve, reject, error) {
	if (error) {
		reject(error);
	} else {
		resolve();
	}
}

describe('Backend proxy integration', () => {
	let app;
	let backend;
	let backendEvents;

	beforeAll(async () => {
		await new Promise((resolve, reject) => {
			app = new Express();

			app.use('/usePathOff', backendProxy({
				usePath: false,
				backend: 'http://127.0.0.1:9012',
				requiredContentType: 'my/content'
			}));

			app.use('/usePathOn', backendProxy({
				usePath: true,
				backend: 'http://127.0.0.1:9012',
				requiredContentType: 'my/content'
			}));

			// Always return the backendResponse field as json
			app.use('*', (request, response) => {
				response.json(request.backendResponse);
				response.end();
			});

			app.server = app.listen(9011, error => resolveRejectError(resolve, reject, error));
		});

		await new Promise((resolve, reject) => {
			backend = http.createServer((request, response) => {
				backendEvents.once('response', backendResponse => {
					response.setHeader('content-type', 'my/content');
					response.end(JSON.stringify(backendResponse), 'utf8');
				});

				backendEvents.emit('request', {
					request,
					response
				});
			});

			backend.listen(9012, error => resolveRejectError(resolve, reject, error));
		});
	});

	afterAll(async () => {
		await new Promise((resolve, reject) => {
			app.server.close(error => resolveRejectError(resolve, reject, error));
		});

		await new Promise((resolve, reject) => {
			backend.close(error => resolveRejectError(resolve, reject, error));
		});
	});

	beforeEach(() => {
		backendEvents = new EventEmitter();
	});

	async function testApp(url, backendResponse, backendAssertions, clientAssertions) {
		// We use the backendEvents to hook into when a request is received, and then provide a response
		backendEvents.once('request', ({request, response}) => {
			backendAssertions(request, response);

			backendEvents.emit('response', backendResponse);
		});

		return new Promise((resolve, reject) => {
			http.get(url, response => {
				let rawData = '';
				response.on('data', chunk => {
					rawData += chunk;
				});
				response.on('end', () => {
					try {
						const parsedData = JSON.parse(rawData);
						clientAssertions(response, parsedData);
						resolve();
					} catch (error) {
						reject(error);
					}
				});
			});
		});
	}

	test('proxies a request with path', async () => {
		const backendData = {hello: 'world!'};
		const backendAssertions = (request, _) => {
			expect(request.url).toEqual('/hello/world');
		};
		const clientAssertions = (response, parsedData) => {
			expect(response.statusCode).toEqual(200);
			expect(parsedData).toEqual(backendData);
		};

		return testApp('http://127.0.0.1:9011/usePathOn/hello/world', backendData, backendAssertions, clientAssertions);
	});

	test('proxies a request without a path', async () => {
		const backendData = {hello: 'world 2!'};
		const backendAssertions = (request, _) => {
			expect(request.url).toEqual('/');
		};
		const clientAssertions = (response, parsedData) => {
			expect(response.statusCode).toEqual(200);
			expect(parsedData).toEqual(backendData);
		};

		return testApp('http://127.0.0.1:9011/usePathOff/hello/world', backendData, backendAssertions, clientAssertions);
	});
});

