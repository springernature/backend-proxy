/*
Example express app that proxies all incoming requests to a backend service and renders the result
 */
const express = require('express');
const handlebars = require('express-handlebars');

const {backendProxy} = require('@springernature/backend-proxy');

const app = express();

// We cheat for this example and host the backend within the app itself
const api = new express.Router();
api.get('/first', (request, response) => {
	response.json({
		string: 'Hello from first route'
	});
});
api.get('/second', (request, response) => {
	response.json({
		string: 'Hello from second route'
	});
});
app.use('/api', api);

app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

app.get('/', backendProxy({
	backend: 'http://localhost:8080/api/first',
	usePath: false
}), (request, response) => {
	response.render('just-text', request.backendResponse);
});

app.get('/other', backendProxy({
	backend: 'http://localhost:8080/api/second',
	usePath: false
}), (request, response) => {
	response.render('just-text', request.backendResponse);
});

app.listen(8080, error => {
	if (error) {
		console.error(error);
		process.exit(1);
	}
	console.log('Listening on http://localhost:8080');
});
