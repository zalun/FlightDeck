var Class = require('shipyard/class/Class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
	Observable = require('shipyard/class/Observable'),
	property = Observable.property,
    Syncable = require('shipyard/sync/Syncable'),
    DummySync = require('shipyard/sync/Dummy'),
    string = require('shipyard/utils/string');

var Folder = module.exports = new Class({
    
    Extends: Model,

    Implements: Syncable,

    Sync: {
        'default': {
            driver: DummySync
        }
    },

    fields: {
        id: fields.NumberField(),
        name: fields.TextField({ required: true }),
        root_dir: fields.TextField({ required: true }) //ChoiceField
    },

	pk: 'uid',

    shortName: property(function() {
        var name = this.get('name');
		if (!name) {
			return null;
		}
        var parts = name.split('/');
        return parts[parts.length - 1];
    }, 'name'),

    fullName: property(function() {
        return this.get('name');
    }, 'name'),

    uid: property(function() {
        return this.get('root_dir') + '/' + this.get('name');
    }, 'root_dir', 'name'),

	toString: function() {
		return this.get('fullName');
	}

});

Folder.ROOT_DIR_LIB = 'l';
Folder.ROOT_DIR_DATA = 'd';
