var Class = require('shipyard/class/Class'),
    property = require('shipyard/class/Observable').property,
    fields = require('shipyard/model/fields'),
    DummySync = require('shipyard/sync/Dummy'),
    
    File = require('./File');


module.exports = new Class({

    Extends: File,

    Sync: {
        'default': {
            driver: DummySync
        }
    },

    fields: {
        url: fields.TextField(),
        data: fields.TextField()
    },

    uid: property(function uid() {
        return this.get('pk');
    }, 'id')

});
