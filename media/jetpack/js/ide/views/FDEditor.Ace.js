/*
 * File: jetpack/FDEditor.Ace.js
 * Extends functionality of FDEditor to support Ace API
 *
 * Class: FDEditor
 */
var Class = require('shipyard/class/Class'),
    object = require('shipyard/utils/object'),
    log = require('shipyard/utils/log'),
    ace = require('ace/ace'),
    FDEditor = require('./FDEditor');

var JSMode = require('ace/mode/javascript').Mode,
    CSSMode = require('ace/mode/css').Mode,
    HTMLMode = require('ace/mode/html').Mode,
    TextMode = require('ace/mode/text').Mode;

var Modes = {
    'javascript': new JSMode(),
    'css': new CSSMode(),
    'html': new HTMLMode(),
    'txt': new TextMode()
};

var stripDeltas = function(stack) {
    // Change Stack (undo/redo) in Ace is represented as
    // [[DeltaObject1], [DeltaObject2], ... ]
    // these objects have to be copied - not referenced
    var deltas = [];
    stack.each(function(single){
        deltas.push(object.merge({}, single[0]));
    });
    return deltas;
};

var buildStack = function(deltas) {
    // Extract stored deltas into the stack
    var stack = [];
    deltas.each(function(delta){
        stack.push([object.merge({}, delta)]);
    });
    return stack;
};

module.exports = new Class({

    Extends: FDEditor,

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
        this.parent(wrapper, options);
        this.editor = ace.edit(this.element.getNode());
        this.editor.getSession().setUseWorker(false);
        this.spinner = this.element.getElement('.ace_scroller');

        var that = this;
        
        ['blur', 'focus'].each(function(ev) {
            that.editor.on(ev, function(){
                that.emit(ev);
            });
        });
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
        this.parent();
    },

    activateItem: function(item) {
        this.parent(item);
        // load undo buffers
        if (this.current.undo_manager) {
            this.setUndoRedoStack(this.current.undo_manager);
        }
    },

    setSyntax: function(kind){
        if (this.available_modes.indexOf(kind) === -1) {
            log.info('Mode (%s) not found. Using txt mode.', kind);
            kind = this.default_kind;
        } else if (this.mode_translate[kind]) {
            kind = this.mode_translate[kind];
        }

        if (!Modes[kind]) {
            // This should only ever be the case if above is broken.
            // ie, available_modes and mode_translate aren't in sync
            // with Modes at the top.
            log.warn('Mode (%s) not found. Bad.');
            kind = this.default_kind;
        }
        this.editor.getSession().setMode(Modes[kind]);
    }

});
