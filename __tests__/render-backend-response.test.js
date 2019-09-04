const {renderBackendResponse} = require('../src/render-backend-response');

describe('Render Backend Response', () => {
	const baseOptions = {
		key: 'testResponse',
		templateKey: '$templateConfig'
	};

	test('returns a middleware function', () => {
		const middleware = renderBackendResponse(baseOptions);

		expect(middleware).toBeInstanceOf(Function);
	});

	test('calls next if backend response is missing', () => {
		const middleware = renderBackendResponse(baseOptions);
		const next = jest.fn();

		middleware({}, undefined, next);

		expect(next).toHaveBeenCalledWith();
	});

	test('calls next with an error if $templateConfig is missing', () => {
		const middleware = renderBackendResponse(baseOptions);
		const next = jest.fn();

		middleware({
			[baseOptions.key]: {}
		}, undefined, next);

		expect(next).toHaveBeenCalledWith(expect.objectContaining({
			statusCode: 500,
			message: expect.stringContaining(`Attempted to render a backend response without a $templateConfig section`)
		}));
	});

	test('calls render with the defined template', () => {
		const middleware = renderBackendResponse(baseOptions);
		const render = jest.fn();
		const backendResponse = {
			$templateConfig: {
				template: 'some-template'
			}
		};

		middleware({
			[baseOptions.key]: backendResponse
		}, {render});

		expect(render).toHaveBeenCalledWith(backendResponse.$templateConfig.template, backendResponse);
	});

	test('calls render with the defined template and sets a layout', () => {
		const middleware = renderBackendResponse(baseOptions);
		const render = jest.fn();
		const backendResponse = {
			$templateConfig: {
				template: 'some-template',
				layout: 'some-layout'
			}
		};
		const res = {
			locals: {},
			render
		};

		middleware({
			[baseOptions.key]: backendResponse
		}, res);

		expect(render).toHaveBeenCalledWith(backendResponse.$templateConfig.template, backendResponse);
		expect(res.locals.layout).toEqual(backendResponse.$templateConfig.layout);
	});
});
