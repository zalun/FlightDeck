var Class = require('shipyard/class/Class'),
    PersistantCollapse = require('./PersistantCollapse'),
    dom = require('shipyard/dom'),
	log = require('shipyard/utils/log');

var localStorage = dom.window.get('localStorage');

module.exports = new Class({

    Extends: PersistantCollapse,

    getState: function(){
        var self = this;
        try {
            return JSON.parse(localStorage.getItem(self.key)) || {};
        } catch (jsonError) {
			log.error('Error decoding tree from localStorage: ', jsonError);
            return {};
        }
    },

    setState: function(element, state){
        this.parent(element, state);
        localStorage.setItem(this.key, JSON.stringify(this.state));
        return this;
    }

});
