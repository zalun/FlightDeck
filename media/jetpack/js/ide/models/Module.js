var Class = require('shipyard/class/Class'),
    File = require('./File'),
    property = require('shipyard/class/Observable').property,
	fields = require('shipyard/model/fields'),
	DummySync = require('shipyard/sync/Dummy'),
    Request = require('shipyard/http/Request'),
    log = require('shipyard/utils/log');

module.exports = new Class({

	Extends: File,

	Sync: {
		'default': {
			driver: DummySync,
			route: '/api/0/modules'
		}
	},

	fields: {
	},

    uid: property(function uid(filename) {
        if (arguments.length === 0) {
            // getter
            return this.get('filename');
        } else {
            // setter
            return this.set('filename', filename);
        }
             
    }, 'filename'),

    loadContent: function(callback) {
        var spinnerEl,
            file = this;

        log.debug('loading content for module (uid:%s)', this.get('uid'));

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
                var mod = JSON.parse(text);
                var code = mod.code || '';
				this.original_content = code;
                this.set('content', code);
                this.emit('loadcontent', code);
                if (callback) {
                    callback.call(this, code);
                }
            }.bind(this)
		}).send();
    }

});
