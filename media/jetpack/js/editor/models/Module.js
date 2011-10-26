var Class = require('shipyard/class/Class'),
    File = require('./File'),
	fields = require('shipyard/model/fields'),
	ServerSync = require('shipyard/sync/Server');

module.exports = new Class({

	Extends: File,

	Sync: {
		'default': {
			driver: ServerSync,
			route: '/api/0/modules'
		}
	},

	fields: {
	}

});
