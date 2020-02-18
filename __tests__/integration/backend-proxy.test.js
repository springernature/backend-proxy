const supertest = require('supertest');
const nock = require('nock');
const express = require('express');
const {backendProxy} = require('../../src/backend-proxy');

const app = express();
const backend = 'http://backend-server:8081';

// Disable all network connections, causing an error if any are made that aren't mocked
nock.disableNetConnect();
// supertest runs the app on 127.0.0.1:randomPort, so need to allow connections there
nock.enableNetConnect('127.0.0.1');

app.use('/usePathOff', backendProxy({
	usePath: false,
	backend,
	requiredContentType: 'application/x+json'
}));

app.use('/usePathOn', backendProxy({
	usePath: true,
	backend,
	requiredContentType: 'application/x+json'
}));

app.use('/changeHostOn', backendProxy({
	backend,
	usePath: true,
	requiredContentType: 'application/x+json',
	changeHost: true
}));

// Always return the backendResponse field as json
app.use('*', (request, response) => {
	response.json(request.backendResponse);
	response.end();
});

describe('Backend proxy integration', () => {
	let request;

	beforeEach(() => {
		request = supertest(app);
	});

	test('proxies a request with path', () => {
		const backendData = {
			hello: 'world'
		};
		const scope = nock(backend).get('/hello/world')
			.reply(200, backendData, {'Content-Type': 'application/x+json'});

		return request.get('/usePathOn/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(200);
				expect(response.body).toEqual(backendData);
			});
	});

	test('proxies a request without a path', () => {
		const backendData = {
			hello: 'world 2'
		};
		const scope = nock(backend).get('/')
			.reply(200, backendData, {'Content-Type': 'application/x+json'});

		return request.get('/usePathOff/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(200);
				expect(response.body).toEqual(backendData);
			});
	});

	test('proxies a request with a changed host', () => {
		const backendData = {
			hello: 'world 3'
		};
		const scope = nock(backend, {
			reqheaders: {
				host: 'backend-server:8081',
				'X-Orig-Host': headerValue => {
					// supertest runs the app on a random port >= 50000
					return headerValue.startsWith('127.0.0.1:');
				}
			}
		}).get('/abc/123')
			.reply(200, backendData, {'Content-Type': 'application/x+json'});

		return request.get('/changeHostOn/abc/123')
			.then(response => {
				scope.done();

				expect(response.status).toBe(200);
				expect(response.body).toEqual(backendData);
			});
	});
});

