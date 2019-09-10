let readFileCallback;

module.exports = {
	readFile: jest.fn().mockImplementation((path, cb) => {
		readFileCallback = cb;
	}),
	__getReadFileCallback: () => readFileCallback
};
