var Class = require('shipyard/class/Class'),
	Model = require('shipyard/model/Model'),
	fields = require('shipyard/model/fields'),
	Syncable = require('shipyard/sync/Syncable'),
	DummySync = require('shipyard/sync/Dummy');

var Package = module.exports = new Class({

	Extends: Model,

	Implements: Syncable,

	Sync: {
		'default': {
			driver: DummySync
		}
	},

	pk: 'id_number',

	fields: {
		id_number: fields.NumberField(), // the real PK?
		full_name: fields.TextField(),
		name: fields.TextField(),
		description: fields.TextField(),
		type: fields.TextField(), //ChoiceField({ choices: ['a', 'l'] })
		author: fields.TextField(),
		url: fields.TextField(),
		license: fields.TextField(),
		version_name: fields.TextField(),
		revision_number: fields.NumberField(),
        view_url: fields.TextField(),
		active: fields.BooleanField(),

        latest: fields.NumberField() // a FK to PackageRevision

		// modules: FK from Module
		// attachments: FK from Attachment
		// dependencies: ManyToManyField('self')
	},

    uid: function() {
        return this.get('id_number');
    },

    shortName: function() {
        //TODO: it might be nice to show the `name` in the tree,
        //so people don't try to require('Twitter Lib'), but instead
        //think require('twitter-lib');
        //return this.get('name');
        return this.get('full_name');
    },

    fullName: function() {
        return this.get('full_name');
    },

    storeNewVersion: function(version_data) {
        this._latest_version = version_data;
    },

    retrieveNewVersion: function() {
        return this._latest_version;
    },

    isAddon: function isAddon() {
        return this.get('type') === this.constructor.TYPE_ADDON;
    },

    isLibrary: function isLibrary() {
        return this.get('type') === this.constructor.TYPE_LIBRARY;
    },

	toString: function() {
		return this.get('full_name');
	}

});

Package.TYPE_ADDON = 'a';
Package.TYPE_LIBRARY = 'l';
