var Class = require('shipyard/class/Class'),
    Collapse = require('./Collapse');

module.exports = new Class({

    Extends: Collapse,

    options: {

        getAttribute: function(element){
            return element.get('id');
        },

        getIdentifier: function(element){
            return 'collapse_' + element.get('id') + '_' + element.get('class').split(' ').join('_');
        }
        
    },

    setup: function(){
        this.key = this.options.getIdentifier.call(this, this.element);
        this.state = this.getState();
        this.parent();
    },

    prepare: function(){
        var obj = this.state;
        this.element.getElements(this.options.listSelector).forEach(function(element){
            if (!element.getElement(this.options.childSelector)) {
                return;
            }
            
			var key = this.options.getAttribute.call(this, element);
			var state = obj[key];
            if (state === 1) {
                this.expand(element);
            } else if (state === 0) {
                this.collapse(element);
            }
        }, this);

        return this.parent();
    },

    getState: function(){
        return {};
    },

    setState: function(element, state){
        this.state[this.options.getAttribute.call(this, element)] = state;
        return this;
    },

    expand: function(element){
        this.parent(element);
        this.setState(element, 1);
        return this;
    },

    collapse: function(element){
        this.parent(element);
        this.setState(element, 0);
        return this;
    }

});
