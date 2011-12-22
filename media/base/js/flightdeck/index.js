var Class = require('shipyard/class/Class'),
	Options = require('shipyard/class/Options'),
	Events = require('shipyard/class/Events');

var FlightDeck = new Class({

	Implements: [Events, Options],

	options: {
		menu_el: 'UI_Editor_Menu',
		try_in_browser_class: 'XPI_test',
		xpi_hashtag: '',
		max_request_number: 50,
		request_interval: 2000
	}

});
