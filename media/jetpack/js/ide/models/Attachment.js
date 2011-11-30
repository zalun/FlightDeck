var Class = require('shipyard/class/Class'),
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

    uid: function uid() {
        return this.get('pk');
    },

    reassign: function(data) {
        //TODO: this makes me cry
        
        //every revision, attachments that have changed get a new `uid`.
        // since Attachments are currently kept track of via the `uid`,
        // we must adjust all instances that keep track of this
        // attachment to use the new id, and any other new options that
        // comes with it

        if (!data.pk || !data.id) {
            data.pk = data.uid;
        }
            
        var packAttachments = fd.item.attachments,
            editorItems = fd.item.editor.items,
            oldUID = this.get('uid');

        delete packAttachments[oldUID];

        this.set(data);

        var newUID = this.get('uid');

        packAttachments[newUID] = this;

        editorItems[newUID] = editorItems[oldUID];
        delete editorItems[oldUID];

        this.fireEvent('reassign', newUID);
    }

});
