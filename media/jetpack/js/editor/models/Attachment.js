var Class = require('shipyard/class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
    Syncable = require('shipyard/sync/Syncable'),
    ServerSync = require('shipyard/sync/Server');

var EDITABLE_EXTS = ['js', 'css', 'html', 'txt', 'md', 'markdown', 'json'];

module.exports = new Class({

    Extends: Model,

    Implements: Syncable,

    Sync: {
        'default': {
            driver: ServerSync,
            route: '/api/0/attachments'
        }
    },

    fields: {
        id: fields.NumberField(),
        filename: fields.TextField({ required: true }),
        ext: fields.TextField(),
        url: fields.TextField(),
        data: fields.TextField()}
    },

    toString: function() {
        return this.get('filename') + '.' + this.get('ext');          
    },

    isEditable: function() {
        return EDITABLE_EXTS.indexOf(this.get('ext')) !== -1;
    }

});
