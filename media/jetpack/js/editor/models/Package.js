var Class = require('shipyard/class'),
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
			route: '/packages'
		}
	},

	fields: {
		id: fields.NumberField(),
		id_number: fields.NumberField(), // the real PK?
		full_name: fields.TextField(),
		name: fields.TextField(),
		description: fields.TextField(),
		type: fields.TextField(), //ChoiceField({ choices: ['a', 'l'] })
		author: fields.TextField(),
		url: fields.TextField(),
		license: fields.TextField(),
		version_name: fields.TextField(),
		revision_number: fields.NumberField()

		// modules: FK from Module
		// attachments: FK from Attachment
		// dependencies: ManyToManyField('self')
	},

	toString: function() {
		return this.get('full_name');
	}

});
