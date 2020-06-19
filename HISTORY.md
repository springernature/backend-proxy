# History

## 2.2.0
_19/06/20_

- Re-introduce `interceptErrors`, as a multiple type (`boolean`|`function`) option
	in order to offer more flexibility on rather to raise a `400 - 599` error or to proxy it to the client. ([morgaan](https://github.com/morgaan))

## 2.0.1
_05/06/20_

- Returns client error status codes from the backend and only raises errors if the backend responds with `500 - 599`. ([springerBuck](https://github.com/springerBuck))

## 2.0.0
_06/05/20_

- Remove `changeHost` and `interceptErrors`. ([joeyciechanowicz](https://github.com/joeyciechanowicz))
- Raise an error if the backend responds with `400 - 599`. ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.4.1
_27/03/20_

- Handle stream aborted. ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.4.0
_11/03/20_

- `interceptErrors` option added. ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.3.2
_26/02/20_

- Fixes `location` header rewriting to only rewrite the host ([springerBuck](https://github.com/springerBuck))

## 1.3.1
_18/02/20_

- Specifies the host header in the correct order. ([joeyciechanowicz](https://github.com/joeyciechanowicz))
- Removes backend domain from location on a 30x response ([springerBuck](https://github.com/springerBuck))

## 1.3.0
_02/02/20_

- Adds support for using JS mocks that use a function that accepts the `express` request object ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.2.0
_27/01/20_

- Adds support for using JS files as a mock ([joeyciechanowicz](https://github.com/joeyciechanowicz) & [morgaan](https://github.com/morgaan))

## 1.1.3
_08/01/20_

- Bump handlebars version to fix critical vulnerability ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.1.2
_06/01/20_

- Whitelist NPM files ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.1.1
_06/01/20_

- Pipe backend headers and status to client ([joeyciechanowicz](https://github.com/joeyciechanowicz))
- Optionally support 'Host' request header ([morgaan](https://github.com/morgaan))
- Fix proxy crashing if no content-type is provided ([joeyciechanowicz](https://github.com/joeyciechanowicz))

## 1.0.0
_03/09/19_

- Initial release ([joeyciechanowicz](https://github.com/joeyciechanowicz))
