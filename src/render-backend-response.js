const {MiddlewareError} = require('./middleware-error');

const defaultOptions = {
	key: 'backendResponse',
	templateKey: '$config'
};

/**
 * Renders a response from a backend, when supplied.
 *
 * @param {object} [options] - Configuration options
 * @param {string} options.key=backendResponse - The property name that the backend response is stored at
 * @param {string} options.templateKey=$config - The property on the backend response that contains the template named and layout
 * @returns {Function} - Middleware for an express application
 */
function renderBackendResponse(options) {
	options = {
		...defaultOptions,
		...options
	};

	return (req, res, next) => {
		const backendResponse = req[options.key];
		if (backendResponse) {
			const templateConfig = backendResponse[options.templateKey];

			if (templateConfig && templateConfig.template) {
				if (templateConfig.layout) {
					res.locals.layout = templateConfig.layout;
				}

				return res.render(templateConfig.template, backendResponse);
			}

			return next(new MiddlewareError(`Attempted to render a backend response without a ${options.templateKey} section`));
		}

		next();
	};
}

module.exports = {renderBackendResponse};
