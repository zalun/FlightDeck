/*
 * Class: FDEditor
 * Ace wrapper
 * Extension for FDEditor to use Ace
 */

Class.refactor(FDEditor, {
    options: {},
    initialize: function(element, options) {
		this.setOptions(options);
		this.changed = false;
		this.initEditor(element);
    },
    initEditor: function(editor_id) {
        this.editor_id = editor_id || this.options.element;
        this.element = $(this.editor_id);
        $log('FD: DEBUG: Fligtdeck.Ace element ' + this.element);
        if (this.element && this.options.activate) {
            ace.edit(this.editor_id);
        }
    },
    getContent: function(){
        return this.element.env.document.getValue();
    },
    setContent: function(value){
        this.element.env.setValue(value);
        return this;
    },
    setSyntax: function(){}
});


