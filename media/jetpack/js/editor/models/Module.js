var Class = require('shipyard/class/Class'),
	Model = require('shipyard/model/Model'),
	fields = require('shipyard/model/fields'),
	Syncable = require('shipyard/sync/Syncable'),
	ServerSync = require('shipyard/sync/Server');

module.exports = new Class({

	Extends: Model,

	Implements: Syncable,

	Sync: {
		'default': {
			driver: ServerSync,
			route: '/api/0/modules'
		}
	},

	fields: {
		id: fields.NumberField(),
		filename: fields.TextField(),
		code: fields.TextField()
	}

});
