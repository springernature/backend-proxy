/*
Example express app that proxies all incoming requests to a backend service and renders the result
 */
const express = require('express');
const handlebars = require('express-handlebars');

const {backendProxy, mockBackendResponse, renderBackendResponse} = require('@springernature/backend-proxy');

const app = new express();

app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

if (process.env.NODE_ENV === 'development') {
	console.log('Adding mocking');
	app.use(mockBackendResponse({
		directory: "./mocks"
	}));
}

app.use(backendProxy({backend: 'http://localhost:8080/api'}));
app.use(renderBackendResponse());

app.listen(8080, (error) => {
	if (error) {
		console.error(error);
		process.exit(1);
	}
	console.log('Listening on http://localhost:8080');
});
