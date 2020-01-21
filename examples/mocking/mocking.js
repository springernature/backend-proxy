const path = require('path');
const express = require('express');

const {mockBackendResponse} = require('@springernature/backend-proxy');

const app = express();

// Add our mock-backend when in dev mode
if (process.env.NODE_ENV === 'development') {
	app.use(mockBackendResponse({
		directory: path.resolve('./mocks')
	}));
}

app.use((request, response) => {
	response.json(request.backendResponse);
});

app.listen(8080, error => {
	if (error) {
		console.error(error);
		process.exit(1);
	}
	console.log('Listening on http://localhost:8080');
});
