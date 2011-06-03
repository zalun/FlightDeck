/*
 * File: jetpack/FDEditor.Ace.js
 * Extends functionality of FDEditor to support Ace API
 *
 * Class: FDEditor
 */

(function() {

    var stripDeltas = function(stack) {
        // Change Stack (undo/redo) in Ace is represented as 
        // [[DeltaObject1], [DeltaObject2], ... ]
        // these objects have to be copied - not referenced
        var deltas = [];
        stack.each(function(single){
            deltas.push(Object.merge({}, single[0]));
        });
        return deltas;
    };

    var buildStack = function(deltas) {
        // Extract stored deltas into the stack
        var stack = [];
        deltas.each(function(delta){
            stack.push([Object.merge({}, delta)]);
        });
        return stack;
    };

    Class.refactor(FDEditor, {

        options: {
            element_type: 'div'
        },

        modes: {},

        available_modes: ['js', 'txt', 'html', 'css'],

        default_kind: 'txt',

        mode_translate: {
            'js': 'javascript',
            'txt': 'text'
        },

        initialize: function(wrapper, options) {
            this.previous(wrapper, options);
            this.editor = ace.edit(this.element);
			this.spinner = new Spinner(this.element.getElement('.ace_scroller'), {
				maskBorder: false
			});
			var that = this;
			
			['blur', 'focus'].each(function(ev) {
				that.editor.on(ev, function(){
					that.fireEvent(ev);
				});
			});
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
            this.editor.setReadOnly(false);
            this.hookChangeIfNeeded();
        },
        
        setReadOnly: function() {
            this.editor.setReadOnly(true);
            if (this.change_hooked) {
                this.unhookChange();
            }
        },
        
        hookChange: function(){
            // hook to onChange Event
            this.editor.getSession().on('change', this.boundWhenItemChanged);
            this.change_hooked = true;
        },

        unhookChange: function(){
            // unhook the onChange Event
            this.editor.getSession().removeEventListener('change', this.boundWhenItemChanged);
            this.change_hooked = false;
        },

        getContent: function(){
            var value = this.editor.getSession().getValue();
            return value;
        },

        _setContent: function(value){
            this.editor.getSession().setValue(value);
			var cursor = this.current.cursorPos || { row: 0, column: 0 };
			this.editor.selection.moveCursorTo(cursor.row, cursor.column);
        },

        getUndoRedoStack: function() {
            var current_manager = this.editor.getSession().getUndoManager();
            return {
                redoDeltas: stripDeltas(current_manager.$redoStack),
                undoDeltas: stripDeltas(current_manager.$undoStack)
            };
        },
        setUndoRedoStack: function(obj){
            var current_manager = this.editor.getSession().getUndoManager();
            current_manager.$redoStack = buildStack(obj.redoDeltas);
            current_manager.$undoStack = buildStack(obj.undoDeltas);
        },

        dumpCurrent: function() {
            // dump undo buffers
            this.current.undo_manager = this.getUndoRedoStack();
			this.current.cursorPos = this.editor.selection.getCursor();
            this.previous();
        },

        activateItem: function(item) {
            this.previous(item);
            // load undo buffers
            if (this.current.undo_manager) {
                this.setUndoRedoStack(this.current.undo_manager);
            }			
        },

        setSyntax: function(kind){
            if (!this.available_modes.contains(kind)) {
                kind = this.default_kind;
            }
            this.addMode(kind);
            this.editor.getSession().setMode(this.modes[kind]);
        }
    });
})();
