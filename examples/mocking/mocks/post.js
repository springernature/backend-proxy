const generateField = () => {
	return {
		string: 'hello from a javascript file'
	};
};

module.exports = {

	$config: {
		template: 'root'
	},
	...generateField()
};

