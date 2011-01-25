/*
 * File: jetpack/FDEditor.js
 * Provides functionality for the Jetpack/Capability Editor
 *
 * Class which provides basic wrapper.
 * Its functionalities should be overwritten in specific classes (Bespin.js, etc.)
 * Otherwise standard textarea will be used.
 */

var FDEditor = new Class({

	Implements: [Options, Events],

    options: {},

	$name: 'FlightDeckEditor',

    items: {},

    current: false,

	initialize: function(wrapper, options) {
		this.setOptions(options);
        // create empty editor
        this.element = new Element('textarea',{
            'text': '',
            'class': 'UI_Editor_Area'
        });
        this.element.inject(wrapper);
		this.changed = false;
        // prepare change events
        this.boundChanged = this.changed.bind(this);
    },

    registerItem: function(item){
        this.items[item.uid] = item; 
    },

    switchTo: function(uid){
        if (this.items[uid]) {
            // deactivate
            this.current.active = false;
            // store changes
            this.current.content = this.getContent();
            this.current = this.items[uid];
            this.current.active = true;
            if (!this.current.content) {
                this.current.retrieveContent(this);
            } else {
                this.setContent(this.current.content);
            }
            if (this.current.readonly) {
                this.setReadOnly();
            } else if (this.element.get('readonly')) {
                this.setEditable();
            }
        }
    },

    setReadOnly: function() {
        this.element.set('readonly', 'readonly');
        if (this.change_hooked) {
            this.unookChange();
        }
    },

    setEditable: function() {
        this.element.erase('readonly');
        if (!this.change_hooked) {
            this.hookChange();
        }
    },

    hookChange: function(){
        this.element.addEvent('keyup', this.boundChanged);
        this.change_hooked = true;
	},

    unhookChange: function(){
        this.element.removeEvent('keyup', this.boundChanged);
        this.change_hooked = false;
    },

    changed: function() {
        this.fireEvent('modification');
        this.current.changed = true;
    }

	getContent: function() {
		return this.element.value;
	},

	setContent: function(value) {
		this.element.set('value', value);
		return this;
	},

    onModification: function() {
        if (this.getValue() != this.current.original_content) {
            this.fireEvent('change');
        } else if (this.current.changed) {
            this.current.changed = false;
        }
    },

    isChanged: function() {
        return this.items.some(function(item) {
            return item.changed;
        });
    }

});
