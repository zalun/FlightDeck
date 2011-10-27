var Class = require('shipyard/class/Class'),
    fields = require('shipyard/model/fields'),
    ServerSync = require('shipyard/sync/Server'),
    
    File = require('./File');


module.exports = new Class({

    Extends: File,

    Sync: {
        'default': {
            driver: ServerSync,
            route: '/api/0/attachments'
        }
    },

    fields: {
        url: fields.TextField(),
        data: fields.TextField()
    },

    uid: function uid() {
        return this.get('pk');
    }

});
