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

app.get('/interceptOn', backendProxy({
	backend,
	requiredContentType: 'application/x+json',
	interceptErrors: true
}));

// Always return the backendResponse field as json
app.use('*', (request, response) => {
	response.json(request.backendResponse);
	response.end();
});

app.use((error, request, response, _) => {
	response.send(`Error ${error.statusCode}`);
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

	test('changes host when proxying', () => {
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

		return request.get('/usePathOn/abc/123')
			.then(response => {
				scope.done();

				expect(response.status).toBe(200);
				expect(response.body).toEqual(backendData);
			});
	});

	test('proxies a request with a changed host if the domain matches the backend domain, but not the backend path', () => {
		const relativePath = `/my-nice/location?here=there#my-id`;
		const scope = nock(backend).get('/hello/world')
			.reply(302, {}, {location: `${backend}/an-extra/path/${relativePath}`});

		return request.get('/usePathOn/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(302);
				expect(response.headers.location).toEqual(`/an-extra/path/${relativePath}`);
			});
	});

	test('proxies a request to redirect', () => {
		const location = 'http://not.the-back.end/my-nice/location?here=there#my-id';
		const scope = nock(backend).get('/hello/world')
			.reply(307, {}, {location});

		return request.get('/usePathOn/hello/world')
			.then(response => {
				scope.done();

				expect(response.status).toBe(307);
				expect(response.headers.location).toEqual(location);
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

	test('intercepts an error from the backend', () => {
		const scope = nock(backend).get('/interceptOn')
			.reply(401, 'You are not authorised to view this content', {'content-type': 'text/plain'});

		return request.get('/interceptOn')
			.then(response => {
				scope.done();

				expect(response.status).toBe(401);
				expect(response.text).toEqual(`Error 401`);
			});
	});
});

