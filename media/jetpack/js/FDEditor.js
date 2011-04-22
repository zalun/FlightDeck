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

    options: {
        element_type: 'textarea'
    },

	$name: 'FlightDeckEditor',

    items: {},

    current: false,

	initialize: function(wrapper, options) {
		this.setOptions(options);
        // create empty editor
        this.element = new Element(this.options.element_type,{
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

    getItem: function(uid){
        return this.items[uid];
    },

    deactivateCurrent: function(){
        // deactivate and store changes                   
        this.current.active = false;
        // store changes
        this.dumpCurrent();
    },

    activateItem: function(item){
        // activate load and hook events
        this.current = item;
        this.current.active = true;
        if (this.current.content == null) {
            this.current.addVolatileEvent('loadcontent', this.boundSetContent);
            this.current.loadContent();
        } else {
            this.setContent(this.current.content);
        }
        if (this.current.options.readonly) {
            this.setReadOnly();
        } else {
            this.setEditable();
        }
        this.setSyntax(this.current.options.type);
    },

    switchTo: function(item){
        $log('FD: DEBUG: FDEditor.switchTo ' + item.uid);
        var self = this;
        this.switching = true;
        if (!this.getItem(item.uid)) {
            this.registerItem(item);
        }
        if (this.current) {
            this.deactivateCurrent();
        }
        this.activateItem(item);
        this.switching = false;
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
        this.hookChangeIfNeeded();
    },
    
    cleanChangeState: function(){
        Object.each(this.items, function(item){
            item.changed = false;
            item.change_hooked = false;
            // refresh original content
            item.original_content = item.content;
        });
        this.hookChangeIfNeeded();
    },

    hookChangeIfNeeded: function() {
        if (!this.current.options.readonly) {
            if (!this.current.changed && !this.change_hooked) {
                this.hookChange();
            } else if (this.current.changed && this.change_hooked) {
                this.unhookChange();
            }
        }
    },

    hookChange: function(){
        this.element.addEvent('keyup', this.boundWhenItemChanged);
        this.change_hooked = true;
	},

    unhookChange: function(){
        this.element.removeEvent('keyup', this.boundWhenItemChanged);
        this.change_hooked = false;
        $log('FD: INFO: No longer following changes');
    },

    whenItemChanged: function() {
        if (!this.switching && this.getContent() != this.current.original_content) {
            this.current.changed = true;
            this.fireEvent('change');
            $log('FD: DEBUG: changed, code is considered dirty and will remain'
                    +'be treated as such even if changes are reverted');
            // fire the fd event
            if (!fd.edited) {
                fd.fireEvent('change');
            }
            this.unhookChange();
        } else if (!this.switching && this.current.changed) {
            this.current.changed = false;
        }
    },

	getContent: function() {
		return this.element.value;
	},

	setContent: function(value) {
		this.element.set('value', value);
		return this;
	},

    isChanged: function() {
        return this.items.some(function(item) {
            return item.changed;
        });
    },

    setSyntax: function(){},
	
	focus: function() {
		this.editor.focus();
		this.fireEvent('focus');
	},
	
	blur: function() {
		this.editor.blur();
		this.fireEvent('blur');
	}
});
