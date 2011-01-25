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
	$name: 'FlightDeckEditor',
	options: {
		activate: false,
		readonly: false
	},
    items: {},
    current: false,
	initialize: function(wrapper, options) {
        this.element = new Element('textarea',{
            'text': '',
            'class': 'UI_Editor_Area'
        });
        this.element.inject(wrapper);
		this.setOptions(options);
		this.changed = false;
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
            this.hookChange();
        }
    },
    hookChange: function(){
        this.element.addEvent('keyup', this.boundChanged);
	},
    unhookChange: function(){
        this.element.removeEvent('keyup', this.boundChanged);
    },
    changed: function() {
        this.fireEvent('change');
        this.changed = true;
    }
	getContent: function() {
		return this.element.value;
	},
	setContent: function(value) {
		this.element.set('value', value);
		return this;
	}
});
