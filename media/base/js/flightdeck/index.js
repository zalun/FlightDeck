var FlightDeck = require('./FlightDeck'),
	showModal = require('./showModal'),
	browser = require('./browser');
require('./request');

exports.init = function(options) {
	var fd = new FlightDeck(options);
	fd.showQuestion = showModal.showQuestion;
	fd.displayModal = showModal.displayModal;
	return fd;
};

exports.browser = function(fd) {
	browser.init(fd);
};
