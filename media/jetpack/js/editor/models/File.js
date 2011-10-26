// Abstract model
var Class = require('shipyard/class/Class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
    Syncable = require('shipyard/sync/Syncable');

var File = module.exports = new Class({

    Extends: Model,

    Implements: Syncable,

    fields: {
        id: fields.NumberField(),
        filename: fields.TextField({ required: true }),
        ext: fields.TextField({ 'default': 'js' }),
        content: fields.TextField()
    },

    shortName: function() {
        return this.get('fullName').split('/').pop();
    },

    fullName: function() {
        var name = this.get('filename'),
            ext = this.get('ext');

        if (ext) {
            return name + '.' + ext;
        } else {
            return name;
        }
    },

    isEditable: function() {
        return this.constructor.EDITABLE_EXTS.indexOf(this.get('ext')) !== -1;
    }

});

File.EDITABLE_EXTS = ['js', 'html', 'css', 'txt', 'json', 'md'];
