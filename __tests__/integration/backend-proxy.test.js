const supertest = require('supertest');
const nock = require('nock');
const express = require('express');
const {backendProxy} = require('../../src/backend-proxy');

const app = express();
const backend = 'http://localhost:8081';

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
				host: 'localhost:8081',
				'X-Orig-Host': 'localhost'
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

	test('proxies a request to redirect and removes backend from the header', () => {
		const relativePath = `/my-nice/location?here=there#my-id`;
		const scope = nock(backend).get('/hello/world')
			.reply(301, {}, {location: `${backend}${relativePath}`});

		return request.get('/usePathOn/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(301);
				expect(response.headers.location).toEqual(relativePath);
			});
	});

	test('proxies a request to redirect', () => {
		const location = 'http://not.the-back.end/my-nice/location?here=there#my-id';
		const scope = nock(backend).get('/hello/world')
			.reply(301, {}, {location: `${location}`});

		return request.get('/usePathOn/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(301);
				expect(response.headers.location).toEqual(location);
			});
	});
});

