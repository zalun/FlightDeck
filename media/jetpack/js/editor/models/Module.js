var Class = require('shipyard/class/Class'),
    File = require('./File'),
	fields = require('shipyard/model/fields'),
	ServerSync = require('shipyard/sync/Server'),
    Request = require('shipyard/http/Request');

module.exports = new Class({

	Extends: File,

	Sync: {
		'default': {
			driver: ServerSync,
			route: '/api/0/modules'
		}
	},

	fields: {
	},

    uid: function() {
         return this.get('filename');
    },

    loadContent: function(callback) {
        var spinnerEl,
            file = this;
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
                var mod = JSON.parse(text);
                var code = mod.code || '';
				this.original_content = code;
                this.set('content', code);
                this.fireEvent('loadcontent', code);
                if (callback) callback.call(this, code);
            }.bind(this)
		}).send();
    }

});
