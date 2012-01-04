var FlightDeck = require('./FlightDeck'),
	showModal = require('./showModal');
require('./request');

exports.init = function(options) {
	var fd = new FlightDeck(options);
	fd.showQuestion = showModal.showQuestion;
	fd.displayModal = showModal.displayModal;
	return fd;
};
