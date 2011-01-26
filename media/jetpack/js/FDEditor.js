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
        this.boundWhenItemChanged = this.whenItemChanged.bind(this);
        this.boundSetContent = this.setContent.bind(this);
    },

    registerItem: function(item){
        this.items[item.uid] = item; 
    },

    switchTo: function(item){
        $log('FD: DEBUG: FDEditor.switchTo ' + item.uid);
        var self = this;
        if (!this.items[item.uid]) {
            this.registerItem(item);
        }
        if (this.current) {
            // deactivate
            this.current.active = false;
            // store changes
            this.dumpCurrent();
        }
        this.current = item;
        this.current.active = true;
        if (!this.current.content) {
            this.current.addEvent('loadcontent', this.boundSetContent);
            this.current.loadContent();
        } else {
            this.setContent(this.current.content);
        }
        if (this.current.options.readonly) {
            this.setReadOnly();
        } else {
            this.setEditable();
        }
        this.setSyntax(item.options.type);
    },

    dumpCurrent: function() {
        this.current.content = this.getContent();
    },

    setReadOnly: function() {
        this.element.set('readonly', 'readonly');
        if (this.change_hooked) {
            this.unookChange();
        }
    },

    setEditable: function() {
        if (this.element.get('readonly')) { 
            this.element.erase('readonly');
        }
        if (!this.change_hooked) {
            this.hookChange();
        }
    },

    hookChange: function(){
        this.element.addEvent('keyup', this.boundWhenItemChanged);
        this.change_hooked = true;
	},

    unhookChange: function(){
        this.element.removeEvent('keyup', this.boundWhenItemChanged);
        this.change_hooked = false;
    },

    whenItemChanged: function() {
        this.fireEvent('modification');
        this.current.changed = true;
        $log('touched');
    },

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
            $log('changed');
        } else if (this.current.changed) {
            this.current.changed = false;
        }
    },

    isChanged: function() {
        return this.items.some(function(item) {
            return item.changed;
        });
    },

    setSyntax: function(){}

});
