// Abstract model
var Class = require('shipyard/class/Class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
    Syncable = require('shipyard/sync/Syncable'),
    Request = require('shipyard/http/Request'),
    string = require('shipyard/utils/string');

var idCounter = 1;

var File = module.exports = new Class({

    Extends: Model,

    Implements: Syncable,

    fields: {
        id: fields.NumberField(),
        filename: fields.TextField({ required: true }),
        ext: fields.TextField({ 'default': 'js' }),
        content: fields.TextField(),
        main: fields.BooleanField({ 'default': false, write: false }),
        readonly: fields.BooleanField({ 'default': false, write: false }),

        url: fields.TextField({ write: false }),
        get_url: fields.TextField({ write: false }),

		active: fields.BooleanField({ write: false, 'default': false })
    },

    initialize: function File(data) {
        this.parent(data);
        if (!this.get('pk')) {
            this.set('pk', idCounter++);
        }
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

    uid: function() {
         //TODO: this should be the unique hash from the new API
        return this._uid || (this._uid = string.uniqueID());
    },

    isEditable: function() {
        return this.constructor.EDITABLE_EXTS.indexOf(this.get('ext')) !== -1;
    },

    isImage: function() {
        return this.constructor.IMAGE_EXTS.indexOf(this.get('ext')) !== -1;
    },

    //TODO: Shipyard Models should probably has a isDirty API
    setChanged: function(isChanged) {
        this.changed = isChanged;
        if (isChanged) {
            this.emit('dirty');
        } else {
            this.emit('reset');
        }
    },

    loadContent: function(callback) {
        var file = this;
        var spinnerEl;
        this.emit('loadstart');
        return new Request({
			method: 'get',
			url: this.get('get_url'),
			useSpinner: !!spinnerEl,
			spinnerTarget: spinnerEl,
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			onSuccess: function(text) {
                var content = text || '';
				file.original_content = content;
                file.set('content', content);
				file.emit('loadcontent', content);
                if (callback) {
					callback.call(this, content);
				}
			}
		}).send();

    },

    isLoaded: function() {
        return this.get('content') != null;
    },

    toString: function() {
        return this.get('fullName');
    }

});

File.EDITABLE_EXTS = ['js', 'html', 'css', 'txt', 'json', 'md'];
File.IMAGE_EXTS = ['png', 'jpg', 'gif'];

var sanitizeRE = /[^a-zA-Z0-9=!@#\$%\^&\(\)\+\-_\/\.]+/g;
File.sanitize = function(name) {
    return name.replace(sanitizeRE, '-');
};
