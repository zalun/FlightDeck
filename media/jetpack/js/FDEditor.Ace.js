/*
 * File: jetpack/FDEditor.Ace.js
 * Extends functionality of FDEditor to support Ace API
 *
 * Class: FDEditor
 */

Class.refactor(FDEditor, {

    initialize: function(wrapper, options) {
		this.setOptions(options);
        // create empty editor
        this.element = new Element('div',{
            'text': '',
            'class': 'UI_Editor_Area'
        });
        this.element.inject(wrapper);
        ace.edit(this.element);
        this.ace = this.element.env;

        if (this.options.readonly) {
            // set read only
        }
		this.changed = false;
        // prepare change events
        this.boundChanged = this.changed.bind(this);
    },
    
    hookChange: function(){
        // hook to onChange Event
        this.change_hooked = true;
	},

    unhookChange: function(){
        // unhook the onChange Event
        this.change_hooked = false;
    },

    getContent: function(){
        return this.ace.getValue();
    },

    setContent: function(value){
        this.ace.setValue(value);
        return this;
    },

    setSyntax: function(){}
});


