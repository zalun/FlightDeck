var Class = require('shipyard/class/Class'),
    Model = require('shipyard/model/Model'),
    fields = require('shipyard/model/fields'),
    Syncable = require('shipyard/sync/Syncable'),
    DummySync = require('shipyard/sync/Dummy');

module.exports = new Class({

    Extends: Model,

    Implements: Syncable,

    Sync: {
        'default': {
            driver: DummySync
        }
    },

    fields: {
        id: fields.NumberField(),
        revision_number: fields.NumberField(),
        created_at: fields.DateField()

        // modules, attachments, dependencies
    }

});
