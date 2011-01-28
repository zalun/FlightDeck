/*
 * File: jetpack/FDEditor.Ace.js
 * Extends functionality of FDEditor to support Ace API
 *
 * Class: FDEditor
 */

Class.refactor(FDEditor, {

    modes: {},

    available_modes: ['js', 'txt', 'html', 'css'],

    default_kind: 'txt',

    mode_translate: {
        'js': 'javascript',
        'txt': 'text'
    },

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
        $log(this.ace);
		this.changed = false;
        // prepare change events
        this.boundWhenItemChanged = this.whenItemChanged.bind(this);
        this.boundSetContent = this.setContent.bind(this);
    },

    addMode: function(mode) {
        var name;
        var Mode;
        if (!this.modes[mode]) {
            name = mode;
            if (this.mode_translate[mode]) {
                name = this.mode_translate[mode];
            }
            Mode = require('ace/mode/' + name).Mode;
            this.modes[mode] = new Mode();
        }
    },

    setEditable: function() {
        this.ace.editor.setReadOnly(false);
        this.hookChangeIfNeeded();
    },
    
    setReadOnly: function() {
        this.ace.editor.setReadOnly(true);
        if (this.change_hooked) {
            this.unhookChange();
        }
    },
    
    hookChange: function(){
        // hook to onChange Event
        this.ace.document.addEventListener('change', this.boundWhenItemChanged);
        this.change_hooked = true;
	},

    unhookChange: function(){
        // unhook the onChange Event
        this.ace.document.removeEventListener('change', this.boundWhenItemChanged);
        this.change_hooked = false;
    },

    getContent: function(){
        return this.ace.document.getValue();
    },

    setContent: function(value){
        this.ace.document.setValue(value);
        return this;
    },

    setSyntax: function(kind){
        if (!this.available_modes.contains(kind)) {
            kind = this.default_kind;
        }
        this.addMode(kind);
        this.ace.document.setMode(this.modes[kind]);
    }
});
