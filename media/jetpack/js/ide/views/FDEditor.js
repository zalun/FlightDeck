/*
 * File: jetpack/FDEditor.js
 * Provides functionality for the Jetpack/Capability Editor
 *
 * Class which provides basic wrapper.
 * Its functionalities should be overwritten in specific classes (Bespin.js, etc.)
 * Otherwise standard textarea will be used.
 */
var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    object = require('shipyard/utils/object'),
    log = require('shipyard/utils/log');

var LOADING_CLASS = 'loading';

var FDEditor = module.exports = new Class({

    Implements: [Options, Events],

    options: {
        element_type: 'textarea'
    },

    items: {},

    current: false,

    initialize: function(wrapper, options) {
        this.setOptions(options);
        wrapper = this.spinner = dom.$(wrapper);
        // create empty editor
        this.element = new dom.Element(this.options.element_type,{
            'text': '',
            'class': 'UI_Editor_Area'
        });
        wrapper.appendChild(this.element);
        this.changed = false;
        // prepare change events
        this.boundWhenItemChanged = this.whenItemChanged.bind(this);
        this.boundSetContent = this.setContent.bind(this);
        this.addListener('setContent', function(c) {
            this.switching = false;
        });
    },

    registerItem: function(uid, item){
        this.items[uid] = item;
        var editor = this;
        item.observe('uid', function(updated, old) {
            editor.items[updated] = item;
            delete editor[old];
        });
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
        var editor = this;
        this.current = item;
        this.current.active = true;
        if (!this.current.isLoaded()) {
            this.spinner.addClass(LOADING_CLASS);
            this.setContent('', true);
            this.current.loadContent(function(content) {
                if (item === editor.current) {
                    editor.setContent(content);
                    editor.spinner.removeClass(LOADING_CLASS);
                }
                //else another file has become active
            });
        } else {
            this.setContent(this.current.get('content'));
            this.spinner.removeClass(LOADING_CLASS);
        }
        if (this.current.get('readonly')) {
            this.setReadOnly();
        } else {
            this.setEditable();
        }
        this.setSyntax(this.current.get('ext'));
    },

    switchTo: function(uid){
        log.debug('FDEditor.switchTo ' + uid);
        var self = this;
        this.switching = true;
        var item = this.getItem(uid);
        if (!item) {
            //this.registerItem(item);
            log.error('No item found in Editor with uid:', uid);
        }
        if (this.current) {
            this.deactivateCurrent();
        }
        this.activateItem(item);
        return this;
    },

    dumpCurrent: function() {
        this.current.set('content', this.getContent());
        return this;
    },

    setReadOnly: function() {
        this.element.set('readonly', 'readonly');
        if (this.change_hooked) {
            this.unhookChange();
        }
    },

    setEditable: function() {
        if (this.element.get('readonly')) {
            this.element.set('readonly', null);
        }
        this.hookChangeIfNeeded();
    },
    
    cleanChangeState: function(){
        object.forEach(this.items, function(item){
            item.setChanged(false);
            item.change_hooked = false;
            // refresh original content
            item.original_content = item.get('content');
        });
        this.hookChangeIfNeeded();
    },

    hookChangeIfNeeded: function() {
        if (!this.current.get('readonly')) {
            if (!this.current.changed && !this.change_hooked) {
                this.hookChange();
            } else if (this.current.changed && this.change_hooked) {
                this.unhookChange();
            }
        }
    },

    hookChange: function(){
        this.element.addListener('keyup', this.boundWhenItemChanged);
        this.change_hooked = true;
    },

    unhookChange: function(){
        this.element.removeEvent('keyup', this.boundWhenItemChanged);
        this.change_hooked = false;
        log.info('No longer following changes');
    },

    whenItemChanged: function() {
        if (!this.switching && this.getContent() !== this.current.original_content) {
            this.current.setChanged(true);
            this.emit('change');
            log.debug('changed, code is considered dirty and will remain'+
                    ' as such even if changes are reverted');
            this.unhookChange();
        } else if (!this.switching && this.current.changed) {
            this.current.setChanged(false);
        }
    },

    getContent: function() {
        return this.element.value;
    },

    setContent: function(value, quiet) {
        this._setContent(value);
        if (!quiet) {
            this.emit('setContent', value);
        }
        return this;
    },
    
    _setContent: function(value) {
        this.element.set('value', value);
    },

    isChanged: function() {
        return this.items.some(function(item) {
            return item.changed;
        });
    },

    setSyntax: function(){},
    
    focus: function() {
        this.editor.focus();
        this.emit('focus');
    },
    
    blur: function() {
        this.editor.blur();
        this.emit('blur');
    }
});
