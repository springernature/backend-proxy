const {mockBackendResponse} = require('./src/mock-backend-response');
const {renderBackendResponse} = require('./src/render-backend-response');
const {backendProxy} = require('./src/backend-proxy');

exports = module.exports = {
	mockBackendResponse,
	renderBackendResponse,
	backendProxy
};
