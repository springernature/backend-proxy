let readFileCb;

module.exports = {
	readFile: jest.fn().mockImplementation((path, cb) => {
		readFileCb = cb;
	}),
	__getReadFileCb: () => readFileCb
};
