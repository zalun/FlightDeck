var Class = require('shipyard/class/Class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
    Syncable = require('shipyard/sync/Syncable'),
    string = require('shipyard/utils/string');

var Folder = module.exports = new Class({
    
    Extends: Model,

    Implements: Syncable,

    fields: {
        name: fields.TextField({ required: true }),
        root_dir: fields.TextField({ required: true }) //ChoiceField
    },

    shortName: function() {
        return this.get('name');
    },

    fullName: function() {
        return this.get('name');
    },

    uid: function() {
        return this.get('root_dir') + '/' + this.get('name');
    }

});

Folder.ROOT_DIR_LIB = 'l';
Folder.ROOT_DIR_DATA = 'd';
