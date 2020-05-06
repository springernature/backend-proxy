# backend-proxy

Express/Connect middleware that proxies requests to a backend and renders the result.

![Version][shield-packagejs-version]
[![Node.js version support][shield-supported-node-version]][package-json]
[![Build status][ci-image]][ci-status]
[![MIT licensed][shield-license]][license]

## Installation

To add `backend-proxy` to your project run
```bash
npm install --save @springernature/backend-proxy
```

## Middleware

### `backendProxy(options)`

The `backend-proxy` middleware will take all incoming HTTP requests and forward them to a backend service. The backend response will then be stored on the original HTTP request to be used by your application, or automatically rendered using `render-backend-response`.

```js
const {backendProxy} = require('@springernature/backend-proxy');

// Proxy all requests to a backend
app.use('*', backendProxy({backend: 'http://my.backend'}));
app.get('*', (req, res) => res.json(req.backendResponse));

// Proxy a specific route to a specific backend
app.use('/login', backendProxy({
    backend: 'http://other.backebd/login',
    usePath: false
}), (req, res) => {
	res.render('login', req.backendResponse);
});
```

The following table describe the properties of the `options` object.

| *Property* | *Description* | *Type* | *Default* |
|---|---|---|---|
| `backend` | Backend service to proxy requests to | string |  |
| `requiredContentType` | Backend response content type thats required to allow interception and deserialization | string | `application/json` |
| `usePath` | Should the incoming HTTP request's path be apended to the `backend` URL | boolean | `true` |
| `key` | The property on the request object that the backend response will be stored under. | string | `backendResponse` |

### `renderBackendResponse(options)`

The `renderBackendResponse` renders any request which has a `backendResponse` on it. The backend response needs to contain a field named `$config` (the name can be changed) which contains the template to render, and layout if needed.

```js
const {backendProxy, renderBackendResponse} = require('@springernature/backend-proxy');

app.use('*', backendProxy({
    backend: 'http://my.backend'
}));
app.use(renderBackendResponse());
```

Example backend response from `http://my.backend` to render the `home` template.
```json
{
  "$config": {
    "template": "home"
  },
  "someField": "some value"
}
```

The following table describe the properties of the `options` object.

| *Property* | *Description* | *Type* | *Default* |
|---------------|------------------------------------------------------------------------------------|--------|-------------------|
| `templateKey` | The property on the backend response that contains the template named (and layout) | string | `$config` |
| `key` | The property on the request object that the backend response will be stored under. | string | `backendResponse` |

### `mockBackendResponse(options)`

Development only middleware that will match incoming requests to a _json_ file, and if found will store it on the request under `backendResponse` simulating what `backendProxy` achieves.
_Note: This middleware will throw an exception if it is run in production_

```js
const {mockBackendResponse, renderBackendResponse} = require('@springernature/backend-proxy');
app.use(mockBackendResponse({
    directory: path.resolve(__dirname, 'backend-mocks')
}));
app.use(renderBackendResponse());
```

The following table describe the properties of the `options` object.

| *Property* | *Description* | *Type* | *Default* |
|-------------|------------------------------------------------------------------------------------|--------|-------------------|
| `directory` | Directory to look for mock files in | string |  |
| `key` | The property on the request object that the backend response will be stored under. | string | `backendResponse` |

#### File structure

The `mockBackendResponse` middleware will match incoming requests to files that match `$PATH_$METHOD.js` or  `$PATH_$METHOD.json`. If both a `.js` and `.json` file exist then the `.js` file will be used.  

```text
.
|___ get.json  # Matches the root request of http://localhost:8080/
|___ login-get.json # Matches an HTTP GET to http://localhost:8080/login
|___ logout-get.js # Matches an HTTP GET to http://localhost:8080/logout
|___ login-post.json # Matches an HTTP POST to http://localhost:8080/login
|___ sub-directory
  |____ other-get.json # Matches an HTTP GET to http://localhost:8080/sub-directory/other
```

## Examples

A set of examples can be found can be [examples](examples) directory. 

## Change Log

[History][history]

## Support

You can have a look at the [Springer Nature Frontend Playbook][support] for an explanation of how we support our open source projects.

## License

[MIT][license]

Copyright © 2019 Springer Nature

[ci-image]: https://travis-ci.org/springernature/backend-proxy.svg?branch=master
[ci-status]: https://travis-ci.org/springernature/backend-proxy

[shield-packagejs-version]: https://img.shields.io/github/package-json/v/springernature/backend-proxy
[shield-supported-node-version]: https://img.shields.io/node/v/@springernature/backend-proxy
[shield-license]: https://img.shields.io/badge/license-MIT-blue.svg

[package-json]: package.json
[license]: LICENSE.md
[history]: HISTORY.md

[support]: https://github.com/springernature/frontend-playbook/blob/master/practices/open-source-support.md
