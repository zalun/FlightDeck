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
		this.changed = false;
        // prepare change events
        this.boundWhenItemChanged = this.whenItemChanged.bind(this);
        this.boundSetContent = this.setContent.bind(this);
    },

    setEditable: function() {
        $log('FD: WARNING: FDEditor.Ace.setEditable - No action!')
        if (!this.change_hooked) {
            this.hookChange();
        }
    },
    
    setReadOnly: function() {
        $log('FD: WARNING: FDEditor.Ace.setReadOnly - No action!')
        if (this.change_hooked) {
            this.unookChange();
        }
    },
    
    hookChange: function(){
        // hook to onChange Event
        $log('FD: WARNING: FDEditor.Ace.hookChange - No action!');
        this.change_hooked = true;
	},

    unhookChange: function(){
        // unhook the onChange Event
        $log('FD: WARNING: FDEditor.Ace.unhookChange - No action!');
        this.change_hooked = false;
    },

    getContent: function(){
        return this.ace.document.getValue();
    },

    setContent: function(value){
        this.ace.document.setValue(value);
        return this;
    },

    setSyntax: function(){
        $log('FD: WARNING: FDEditor.Ace.setSyntax - No action!');
    }
});


