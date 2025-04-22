/*
Example express app that proxies all incoming requests to a backend service and renders the result
 */
const express = require('express');
const handlebars = require('express-handlebars');

const {backendProxy, renderBackendResponse} = require('@springernature/backend-proxy');

const app = express();

// We cheat for this example and host the backend within the app itself
const api = new express.Router();
api.get('/', (request, response) => {
	response.json({
		$config: {
			template: 'home'
		},
		time: new Date()
	});
});
api.get('/other', (request, response) => {
	response.json({
		$config: {
			template: 'other'
		},
		string: 'Hello world!'
	});
});
app.use('/api', api);

app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

app.use(backendProxy({
	backend: 'http://localhost:8080/api',
	requiredContentType: ''
}));

app.use(renderBackendResponse());

app.listen(8080, error => {
	if (error) {
		console.error(error);
		process.exit(1);
	}
	console.log('Listening on http://localhost:8080');
});
