
/*
Echos back the GET parameters (the URL after the ? sign)
 */
module.exports = function (request) {
	return request.query;
};
