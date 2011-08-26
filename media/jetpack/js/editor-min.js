(function() {

function _define(module, deps, payload) {
	define.modules[module] = payload;
}

_define.modules = {};
if (window.define) {
	_define.original = window.define;
	_define.modules = _define.original.modules;
}
window.define = _define;


function require(module, callback) {
	var payload = lookup(module) || lookup(normalize(module, 'index'));
	if (!payload && require.original)
		return require.original.apply(window, arguments);
	
	if (callback) callback();

	return payload;
}

require.paths = [];
if (window.require) require.original = window.require;
window.require = require;

function lookup(id) {
	var payload = define.modules[id];
	if (!payload) return null;

	if (typeof payload === 'function') {
		var module = {
			exports: {},
			id: id
		}
		var relativeRequire = function(name) {
			if (name.charAt(0) == '.') name = normalize(dirname(id), name);
			return require.apply(window, arguments);
		};
		relativeRequire.paths = require.paths;
		payload(relativeRequire, module.exports, module);
		define.modules[id] = module;
		return module.exports;
	} else {
		return payload.exports || payload;
	}
}

function normalize(base, path){
	if (path[0] == '/') base = '';
	path = path.split('/').reverse();
	base = base.split('/');
	var last = base.pop();
	if (last && !(/\.[A-Za-z0-9_-]+$/).test(last)) base.push(last);
	var i = path.length;
	while (i--){
		var current = path[i];
		switch (current){
			case '.': break;
			case '..': base.pop(); break;
			default: base.push(current);
		}
	}
	return base.join('/');
};

function dirname(filename) {
    var parts = filename.split('/');
    parts.pop(); //bye filename
    return parts.join('/');
};

})();
define('editor/index', [], function(require, exports, module){
require.paths.unshift('/media/lib/shipyard/lib');

//exports.Package = require('./models/Package');

// requiring these now so they are included in the bundle
// eventually, this file would connect Models and Views with some
// controllers
exports.Ace = require('./views/FDEditor.Ace');
exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');

});
define('editor/views/FDEditor.Ace', [], function(require, exports, module){
/*
 * File: jetpack/FDEditor.Ace.js
 * Extends functionality of FDEditor to support Ace API
 *
 * Class: FDEditor
 */
var Class = require('shipyard/class'),
	object = require('shipyard/utils/object'),
	ace = require('ace/ace'),
	FDEditor = require('./FDEditor');

// globals: Spinner

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
		this.editor = ace.edit(this.element);
		this.editor.getSession().setUseWorker(false);
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
			//TODO: explicitly require the modes we plan to use up
			//above, so that they can be bundled with `shipyard build`
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
		if (!this.available_modes.contains(kind)) {
			kind = this.default_kind;
		}
		this.addMode(kind);
		this.editor.getSession().setMode(this.modes[kind]);
	}

});

});
define('shipyard/class/index', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var object = require('../utils/object'),
	typeOf = require('../utils/type').typeOf,
	overloadSetter = require('../utils/function').overloadSetter,
	merge = object.merge,
	extend = object.extend;

function Class(params) {
	function klass() {
		reset(this);
		return this.initialize ? this.initialize.apply(this, arguments) : this;
	};
	if (typeOf(params) == 'function') params = { initialize: params };
	params = params || { initialize: function(){} };
	
	//Extends "embedded" mutator
	var parent = params.Extends || Class;
	delete params.Extends;
	if (parent != Class && !(parent.prototype instanceof Class)) 
		throw new Error('Class must extend from another Class.');
	var proto = reset(object.create(parent.prototype));
	merge(klass, parent); //inherit "static" properties
	klass.prototype = proto;
	klass.prototype.constructor = klass;
	klass.implement = implement;
	mutate(klass, params);
	klass.parent = parent;
	return klass;
};

Class.prototype.parent = function parent() {
	if (!this.$caller) throw new Error('The method "parent" cannot be called.');
	var name = this.$caller.$name,
		parent = this.$caller.$owner.parent,
		previous = parent ? parent.prototype[name] : null;
	if (!previous) throw new Error('The method "' + name + '" has no parent.');
	return previous.apply(this, arguments);
};

Class.prototype.toString = function toString() {
	return '[object Class]';
};

var dontMutate = ['constructor', 'parent'];
function mutate(child, parent, nowrap) {
	for (var key in parent) {
		var val = parent[key];
		if (child.Mutators.hasOwnProperty(key)) {
			val = child.Mutators[key].call(child, val);
			if (val == null) continue;
		}
		
		if (~dontMutate.indexOf(key)) continue;

		if (!nowrap && typeOf(val) == 'function') {
			val = wrap(child, key, val)
		}
		merge(child.prototype, key, val);
	}
};

var parentPattern = /xyz/.test(function(){xyz;}) ? /\.parent[\(\.\[]/ : null;
function wrap(me, key, fn) {
	if (fn.$origin) fn = fn.$origin;
	if (parentPattern && !parentPattern.test(fn)) return fn;
	var wrapper = extend(function method() {
		var caller = this.caller,
			current = this.$caller;
		this.caller = current;
		this.$caller = wrapper;
		var result = fn.apply(this, arguments);
		this.$caller = current;
		this.caller = caller;
		return result;
	}, { $name: key, $origin: fn, $owner: me });
	return wrapper;
};



var implement = overloadSetter(function implement(key, value) {
	var params = {};
	params[key] = value;
	mutate(this, params);
	return this;
});


function reset(obj) {
	for (var key in obj) {
		var value = obj[key];
		switch (typeOf(value)) {
			case 'object':
				obj[key] = reset(object.create(value));
				break;
			case 'array':
				obj[key] = object.clone(value);
				break;
		}
	}
	return obj;
};

function isArray(obj) {
	return obj.length !== null && !~['function', 'string'].indexOf(typeof obj);
};

Class.Mutators = {
	Implements: function Implements(mixins) {
		mixins = isArray(mixins) ? mixins : [mixins];
		for (var i = 0, len = mixins.length; i < len; i++) {
			merge(this, mixins[i]);
			mutate(this, object.create(mixins[i].prototype), true);
		}
	}
}

module.exports = Class;

});
define('shipyard/utils/object', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var typeOf = require('./type').typeOf;

exports.extend = function extend(child, parent) {
	for(var i in parent) {
		child[i] = parent[i];
	} 
	return child;
};

var mergeOne = function(source, key, current){
	switch (typeOf(current)){
		case 'object':
			if (typeOf(source[key]) == 'object') mergeObject(source[key], current);
			else source[key] = cloneObject(current);
		break;
		case 'array': source[key] = cloneArray(current); break;
		default: source[key] = current;
	}
	return source;
};

var mergeObject = exports.merge = function merge(source, k, v) {
	if (typeOf(k) == 'string') return mergeOne(source, k, v);
	for (var i = 1, l = arguments.length; i < l; i++){
		var object = arguments[i];
		for (var key in object) mergeOne(source, key, object[key]);
	}
	return source;
};

var cloneOf = exports.clone = function clone(item) {
	switch (typeOf(item)){
		case 'array': return cloneArray(item);
		case 'object': return cloneObject(item);
		default: return item;
	}
};

var cloneArray = function(arr) {
	var i = arr.length, clone = [];
	while (i--) clone[i] = cloneOf(arr[i]);
	return clone;
};

var cloneObject = function(obj) {
	var clone = {};
	for (var key in obj) clone[key] = cloneOf(obj[key]);
	return clone;
}

exports.forEach = function forEach(obj, fn, bind) {
	for (var key in obj) if (obj.hasOwnProperty(key)) {
		fn.call(bind || obj, obj[key], key, obj);
	}
};

exports.map = function map(obj, fn, bind) {
	var results = {};
	for (var key in obj) results[key] = fn.call(bind || obj, obj[key], key, obj);
	return results;
}

exports.create = Object.create || function create(obj) {
	var F = function(){};
	F.prototype = obj;
	return new F;
};

exports.toQueryString = function toQueryString(obj, base) {
	var queryString = [];
	
	exports.forEach(obj, function(value, key) {
		if (value == null) return;
		if (base) key = base + '[' + key + ']';
		var result;
		switch (typeOf(value)) {
			case 'object': 
				result = exports.toQueryString(value, key);
				break;
			case 'array':
				var obj = {};
				for (var i = 0; i < value.length; i++) {
					obj[i] = value[i];
				}
				result = exports.toQueryString(obj, key);
				break;
			default: 
				result = key + '=' + encodeURIComponent(value);
		}
		queryString.push(result)
	});

	return queryString.join('&');
};

});
define('shipyard/utils/type', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var toString = Object.prototype.toString;
var typeCheck = /\[object\s(\w*)\]/;
var toType = function(item) {
	return toString.call(item).replace(typeCheck, '$1').toLowerCase();
}

exports.typeOf = function(item) {
	if (item == null) return 'null';
	var type = toType(item);
	if (type != 'object') return type;

	if (item.nodeName){
		if (item.nodeType == 1) return 'element';
		if (item.nodeType == 3) return (/\S/).test(item.nodeValue) ? 'textnode' : 'whitespace';
	} else if (typeof item.length == 'number'){
		if (item.callee) return 'arguments';
		if ('item' in item) return 'collection';
		if (typeof item !== 'function') return 'array';
	}

	return typeof item;
};

});
define('shipyard/utils/function', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var typeOf = require('./type').typeOf;

// Allows fn(params) -> fn(key, value) for key, value in params
exports.overloadSetter = function(fn) {
	return function(keyOrObj, value) {
		if (typeOf(keyOrObj) != 'string') {
			for (var key in keyOrObj) {
				fn.call(this, key, keyOrObj[key]);
			}
		} else {
			fn.call(this, keyOrObj, value);
		}
		return this;
	};
};

// Allows some setup to be called the first. The setup function must
// return a function that will be assigned to same property of the
// object.
exports.lazy = function(obj, key, setup) {
	obj[key] = function() {
		obj[key] = setup.apply(this, arguments);
		obj[key].apply(this, arguments);
	};
};

});
define('editor/views/FDEditor', [], function(require, exports, module){
/*
 * File: jetpack/FDEditor.js
 * Provides functionality for the Jetpack/Capability Editor
 *
 * Class which provides basic wrapper.
 * Its functionalities should be overwritten in specific classes (Bespin.js, etc.)
 * Otherwise standard textarea will be used.
 */
var Class = require('shipyard/class'),
	Events = require('shipyard/class/Events'),
	Options = require('shipyard/class/Options')
	object = require('shipyard/utils/object');

// globals: Element, Spinner, Element.addVolatileEvent, fd

var FDEditor = module.exports = new Class({

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
		this.spinner = new Spinner('editor-wrapper');
		this.changed = false;
        // prepare change events
        this.boundWhenItemChanged = this.whenItemChanged.bind(this);
        this.boundSetContent = this.setContent.bind(this);
        this.addEvent('setContent', function(c) {
            this.switching = false;
        });
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
        if (!this.current.isLoaded()) {
            this.spinner.show();
			this.setContent('', true);
			this.current.addVolatileEvent('loadcontent', function(content) {
                //if item == this.current still
                if (item == this.current) {
                    this.setContent(content);
					this.spinner.hide();
                }
                //else another file has become active
            }.bind(this));
            this.current.loadContent();
        } else {
            this.setContent(this.current.content);
			this.spinner.hide();
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
    },

    dumpCurrent: function() {
        this.current.content = this.getContent();
    },

    setReadOnly: function() {
        this.element.set('readonly', 'readonly');
        if (this.change_hooked) {
            this.unhookChange();
        }
    },

    setEditable: function() {
        if (this.element.get('readonly')) { 
            this.element.erase('readonly');
        }
        this.hookChangeIfNeeded();
    },
    
    cleanChangeState: function(){
        object.forEach(this.items, function(item){
            item.setChanged(false);
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
            this.current.setChanged(true);
            this.fireEvent('change');
            $log('FD: DEBUG: changed, code is considered dirty and will remain'
                    +'be treated as such even if changes are reverted');
            // fire the fd event
            if (!fd.edited) {
                fd.fireEvent('change');
            } else {
				fd.edited++;
			}
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
        if (!quiet) this.fireEvent('setContent', value);
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
		this.fireEvent('focus');
	},
	
	blur: function() {
		this.editor.blur();
		this.fireEvent('blur');
	}
});

});
define('shipyard/class/Events', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('./'),
	overloadSetter = require('../utils/function').overloadSetter;

function addEvent(evt, fn, internal) {
	evt = removeOn(evt);

	var events = this.$events[evt] = (this.$events[evt] || [])
	events.push(fn);
	return this;
}

function removeEvent(evt, fn) {
	evt = removeOn(evt);
	
	var events = this.$events[evt];
	if (events) {
		var index = events.indexOf(fn);
		if (~index) delete events[index];
	}
	return this;
}

function removeOn(string) {
	return string.replace(/^on([A-Z])/, function(full, first) {
		return first.toLowerCase();
	});
}

module.exports = new Class({
	
	$events: {},
	
	addEvent: addEvent,

	addEvents: overloadSetter(addEvent),

	removeEvent: removeEvent,

	removeEvents: overloadSetter(removeEvent),

	fireEvent: function fireEvent(evt) {
		evt = removeOn(evt);

		var events = this.$events[evt];
		if (!events) return this;

		var args = [].slice.call(arguments, 1);

		events.forEach(function(fn) {
			fn.apply(this, args);
		}, this);
		
		return this;
	}

});

});
define('shipyard/class/Options', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('./'),
	merge = require('../utils/object').merge
	overloadSetter = require('../utils/function').overloadSetter;

var onEventRE = /^on[A-Z]/;

function getOption(name) {
	if (!this.options) return null;
	return this.options[name];
}

function setOption(name, value) {
	if (!this.options) this.options = {};
	if (this.addEvent && onEventRE.test(name) && typeof value == 'function') {
		this.addEvent(name, value);
	} else {
		merge(this.options, name, value);
	}
	return this;
}

module.exports = new Class({

	getOption: getOption,

	setOption: setOption,
	
	setOptions: overloadSetter(setOption)

});

});
define('editor/views/Sidebar', [], function(require, exports, module){
var Class = require('shipyard/class'),
	Events = require('shipyard/class/Events'),
	Options = require('shipyard/class/Options'),
	object = require('shipyard/utils/object'),
	
	FileTree = require('./FileTree');

// globals: $, FlightDeck.Keyboard, fd.item

var Sidebar = module.exports = new Class({
	
	Implements: [Options, Events],
	
	options: {
		file_selected_class: 'UI_File_Selected',
		file_normal_class: 'UI_File_Normal',
        file_modified_class: 'UI_File_Modified',
		file_listing_class: 'tree',
		editable: false
	},
	
	trees: {},
	
	initialize: function(options){
		this.setOptions(options);
		this.element = $('app-sidebar');
		this.bind_keyboard();
	},
	
	buildTree: function() {
		var that = this;
		var treeOptions = {
			checkDrag: function(el){
				return (el.get('rel') == 'file') && !el.hasClass('nodrag') && that.options.editable && !el.getElement('> .holder > .label[contenteditable="true"]');
			},
			checkDrop: function(el, drop){
				var isFile = el.get('rel') == 'file',
					isSibling = this.current.getSiblings().contains(el);
					
				return (
						((drop.isSubnode || isSibling) && isFile)
						|| el.hasClass('top_branch')
						|| isSibling && !isFile && !drop.isSubnode
						|| !isFile && drop.isSubnode && this.current.getParent().getParent() == el
					) ? false : true;
			},
			onChange: function(){
				var file = this.current.retrieve('file');
				if (file) {
				    that.renameFile(file, this.getFullPath(this.current));
				}
                // remove this folder, since the back-end already deleted
                // it in a signal.
                that.silentlyRemoveFolders(this.current);
			},
			editable: this.options.editable
		};
		
		// Tree and Collapse initilizations
		var trees = this.trees;
		var topBranchOptions = {
			add: this.options.editable,
			edit: false,
			remove: false,
			collapsed: false
		};
		
		var addon_or_lib_url = window.location.pathname.match(/\/[a-z]+\/\d+\//g)[0]
				.replace(/\//g, '_');
		
		var collapseOptions = {
			getAttribute: function(element) {
				return element.get('path') || element.get('id');
			},
			getIdentifier: function(element) {
				return addon_or_lib_url + '_collapse_' + element.get('id')
			}
		};
		
		if($('LibTree') && !trees.lib) {
			trees.lib = new FileTree('LibTree', Object.merge({
			    id_prefix: 'l'
			}, treeOptions));
			trees.lib.collapse = new FileTree.Collapse('LibTree', collapseOptions);
			trees.lib.addBranch({
				'rel': 'directory',
				'title': 'Lib',
				'id': 'lib_branch',
				'class': 'top_branch nodrag'
			}, null, topBranchOptions);
			trees.lib.collapse.prepare();
		}
		
		if($('DataTree') && !trees.data) {
			trees.data = new FileTree('DataTree', Object.merge({
			    id_prefix: 'd'
			},treeOptions));
			trees.data.collapse = new FileTree.Collapse('DataTree', collapseOptions);
			trees.data.addBranch({
				'rel': 'directory',
				'title': 'Data',
				'id': 'data_branch',
				'class': 'top_branch nodrag'
			}, null, topBranchOptions);
			trees.data.collapse.prepare();
		}
			
		if($('PluginsTree') && !trees.plugins) {	
			trees.plugins = new FileTree('PluginsTree', Object.merge({}, treeOptions, { actions: {
				add: false,
				edit: false,
				remove: true
			}}));
			trees.plugins.collapse = new FileTree.Collapse('PluginsTree', collapseOptions);
			var pluginsBranch = trees.plugins.addBranch({
				'rel': 'directory',
				'title': 'Libraries',
				'id': 'plugins_branch',
				'class': 'top_branch nodrag'
			}, null, topBranchOptions);
			
			var sdkBranch = $('core_library_lib');
			if(sdkBranch) {
				pluginsBranch.getElement('ul').grab(sdkBranch);
			}
			trees.plugins.collapse.prepare();
		}

		this.attach();
		
		return this;
	},
	
	attach: function() {
		var that = this,
			sidebarEl = $(this);
			
		// highlight branch on click
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .label:not([contenteditable="true"]))'.substitute(this.options), function(e) {
			that.selectFile($(e.target).getParent('li'));
		});
		
		//adding modules to Lib
		if(this.trees.lib) {
			$(this.trees.lib).addEvent('click:relay(.add)', function(e) {
				that.promptNewFile(e.target.getParent('li'));
			});
		}
		
		//adding attachments to Data
		if(this.trees.data) {
			$(this.trees.data).addEvent('click:relay(.add)', function(e) {
				that.promptAttachment(e.target.getParent('li'));
			});
		}
		
		//adding User Libraries to Plugins
		if(this.trees.plugins) {
			$(this.trees.plugins).addEvents({
				'click:relay(li.top_branch > .holder .add)': function(e) {
					that.promptPlugin();
				},
				'click:relay(li.update > .holder .icon)': function(e) {
					e.stop();
					that.promptPluginUpdate(e.target.getParent('li.update'));
				}
			});
		}
		
		// delete
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .actions .delete)'.substitute(this.options), function(e) {
			var li = $(e.target).getParent('li'),
			    file = li.retrieve('file'),
			    isModules = li.getParent('.tree').get('id') == 'LibTree';
			if (file) {
				if (!file.options.readonly) {
					that.promptRemoval(file);
				}
			} else {
				that.promptRemoval(li.get('path'), isModules ? Module : Attachment)
				$log('a non-empty folder');
			}
			
		});
		
		Object.each(this.trees, function(tree, name) {
			tree.addEvents({
				'renameComplete': function(li, fullpath) {
					var file = li.retrieve('file');
					if (file) {
					    that.renameFile(li.retrieve('file'), fullpath);
					} 					
				}
			});
		});
		
		return this;
	},
	
	renameFile: function(file, fullpath) {
		var pack = fd.getItem();
		if (file instanceof Module) {
			pack.renameModule(file.options.filename, fullpath);
		} else if (file instanceof Attachment) {
			pack.renameAttachment(file.options.uid, fullpath);
		}
	},
	
	removeFileFromTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this,
			el;
			
		el = this.getBranchFromFile(file);
		if (el) {
			tree.removeBranch(el);
		}
	},
	
	addFileToTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this;
			
		if (!tree) {
			this.buildTree();
			tree = this.trees[treeName];
		}
		
		var options = {
			target:	$(tree).getElement('.top_branch'),
			url: file.options.url
		};
	
		if (!this.options.editable || file.options.main) {
			options.add = false
			options.edit = false;
			options.remove = false;
			options.nodrag = true;
		}
		
		
		var element = tree.addPath(file, options);	
		tree.collapse.prepare();
		
		
		file._removeFromTree = function() {
			that.removeFileFromTree(treeName, file);
		};
		
		file.addEvent('destroy', file._removeFromTree);
		file.addEvent('destroy', function() {
			element.erase('file');
		});

        file.addEvent('select', function() {
            if (file.is_editable()) {
                that.setSelectedFile(file);
            }
        });
        
        // file.onChange should add an asterisk to the tree branch
        // file.onReset should remove the asterisk
        file.addEvent('change', function() {
            element.addClass(that.options.file_modified_class);
        });
        file.addEvent('reset', function() {
            element.removeClass(that.options.file_modified_class);
        });
		
		//check all of element's parents for Folders, destroy them
		this.silentlyRemoveFolders(element);
		
		if((file.options.active || file.options.main) && file.is_editable()) {
			this.setSelectedFile(element);
		}
	}.protect(),
	
	addLib: function(lib) {
		this.addFileToTree('lib', lib);
	},
	
	removeFile: function(file, prefix) {
		$log('sidebar destroy')
	    
	    if (file instanceof File) {
	        file.destroy();
	        return;
	    }
	        
        if (prefix) prefix+='-';
        var li = $(prefix+file.replace(/\//g, '-'));
        
        if (li) {
            li.destroy();
        }
	},
	
	addData: function(attachment) {
		this.addFileToTree('data', attachment);
	},
	
	addPlugin: function(plugin) {
		this.addFileToTree('plugins', plugin);
	},
	
	getBranchFromFile: function(file) {
		var branch,
			title,
            tree;
		
		if(file instanceof Library) {
			title = file.getID();
            tree = 'plugins';
		} else if (file instanceof Folder) {
			title = file.options.name;
            tree = file.options.root_dir == Folder.ROOT_DIR_LIB
                ? 'lib' : 'data';
		} else if (file instanceof Module 
                || file instanceof Attachment) {
			title = file.options.filename + '.' + file.options.type;
            tree = file instanceof Module ? 'lib' : 'data';
		} else {
            return null; //throw Error? this is a bad case!
        }
		
        branch = this.getBranchFromPath(title, tree);	
		return branch;
	},

    getBranchFromPath: function(path, treeName) { 
		var tree = this.trees[treeName];
        if (!tree) return null;
        return $(tree).getElement('li[path="{p}"]'.substitute({p:path}));
    },
	
	setSelectedFile: function(el) {
		var options = this.options;
		
		if (el instanceof File) el = this.getBranchFromFile(el);
		
		$(this).getElements('.'+options.file_listing_class+' li')
			.removeClass(options.file_selected_class)
			.addClass(options.file_normal_class);
		
		el.removeClass(options.file_normal_class)
			.addClass(options.file_selected_class);
		
		//also be sure to expand all parent folders
		var tree = new Tree(el.getParent('.tree')),
			node = el;
		
		while (node = node.getParent('li')) {
			tree.collapse.expand(node);
		}
		
		return this;
	},
	
	selectFile: function(li) {
		var file = li.retrieve('file');
		if(file) {
			file.onSelect();
		}
	},
    
    silentlyRemoveFolders: function(element) {
        var node = element;
        while (node = node.getParent('li')) {
            
        	var emptydir = node.retrieve('file');
        	if (emptydir instanceof Folder) {
        		emptydir.removeEvent('destroy', emptydir._removeFromTree);
        		node.eliminate('file');
        		emptydir.destroy();
        	}
        }
    },
	
	promptRemoval: function(file, fileType) {
		var title = 'Are you sure you want to remove {type}"{name}"?',
		    titleOpts = {type: ''};

		if (fileType != null) {
		    titleOpts.name = file + " and all its files";
		} else {
            if (file.options.filename && file.options.type) {
                titleOpts.name = file.options.filename + "." + file.options.type;
            } else if (file.options.full_name) {
                titleOpts.name = file.options.full_name;
            } else if (file.getFullName) {
                titleOpts.type = "an empty folder ";
                titleOpts.name = file.getFullName();
            }
		}
		
		if (fileType == Attachment) {
		    $log('FD: TODO: remove entire attachment folders');
		    //fd.alertNotImplemented('Deleting a Data folder with subcontent is under construction. A work around, is to manually delete every single attachment inside the folder before removing the folder. Ya, we know.');
		    //return;
		}
		
        titleOpts.name = titleOpts.name.split('/').getLast();
		fd.showQuestion({
			title: title.substitute(titleOpts),
			message: file instanceof Module ? 'You may always copy it from this revision' : '',
			buttons: [
				{
					'type': 'reset',
					'text': 'Cancel',
					'class': 'close'
				},
				{
					'type': 'submit',
					'text': 'Remove',
					'id': 'remove_file_button',
					'default': true,
					'irreversible': true,
					'callback': function() {
						if (file instanceof Module) {
							fd.getItem().removeModule(file);
						} else if (file instanceof Attachment) {
							fd.getItem().removeAttachment(file);
						} else if (file instanceof Library) {
							fd.getItem().removeLibrary(file);
						} else if (file instanceof Folder) {
							fd.getItem().removeFolder(file);
						} else if (fileType == Module) {
							fd.getItem().removeModules(file);
						} else if (fileType == Attachment) {
							$log('removing folder')
							fd.getItem().removeAttachments(file);
						}
						
					}
				}
			]
		});
	},
	
	promptNewFile: function(folder) {
		var path = (folder && folder.get('path')) || '';
		if (path) path += '/';
		
		fd.showQuestion({
			title: 'Create a new file or folder',
			message: '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>' +
				'<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>' +
				'<input type="text" name="new_file" id="new_file" placeholder="Enter name..." />',
			ok: 'Create',
			id: 'create_new_file',
			callback: function() {
				// get data
				var filename = path + $('new_file').value,
					pack = fd.getItem();
					
				if (!filename) {
					fd.error.alert(
                        'Filename can\'t be empty', 
                        'Please provide the name of the module');
					return;
				}
				
                // remove janky characters from filenames
                // (from promptAttachment)
                filename = filename.replace(/[^a-zA-Z0-9\-_\/\.]+/g, '-');
                filename = filename.replace(/\/{2,}/g, '/');

				if (filename[filename.length-1] == '/') {
					isFolder = true;
					filename = filename.substr(0, filename.length-1);
				} else {
					//strip off any extensions
					filename = filename.replace(/^\//, '');
					filename = filename.replace(/\.[^\.]+$/, '');
				}
                
				if (!isFolder && Module.exists(filename)) {
					fd.error.alert('Filename has to be unique', 'You already have the module with that name');
					return;
				} else if (isFolder && Folder.exists(filename, Folder.ROOT_DIR_LIB)) {
					fd.error.alert('Folder has to be unique', 'You already have the folder with that name');
					return;
				}
                if (['-', ''].contains(filename.get_basename(isFolder))) {
                    fd.error.alert(
                            'ERROR',
                            'Please use alphanumeric characters for filename');
                    return;
                }
				
				
				if (isFolder){
					pack.addFolder(filename, Folder.ROOT_DIR_LIB);
				} else {
					pack.addModule(filename);
				}
			}
		});

		//hookup File / Folder buttons
		var fileBtn = $('new_type_file'),
			folderBtn = $('new_type_folder'),
			isFolder = false;
			
		fileBtn.addEvent('click', function(e) {
			e.stop();
			folderBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = false;
		});
		
		folderBtn.addEvent('click', function(e) {
			e.stop();
			fileBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = true;
		});
	},
	
	promptAttachment: function(folder) {
        var basename,
            that = this,
            pack = fd.getItem(),
            path = (folder && folder.get('path')) || '';
        if (path) path += '/';
		fd.showQuestion({
			title: 'Create or Upload an Attachment',
			message: ''
                + '<form id="upload_attachment_form" method="post" enctype="multipart/form-data" action="'
                    + pack.options.upload_attachment_url + '">'
                    + '<input type="file" name="upload_attachment" id="upload_attachment"/></p>'
                + '</form>'
				+ '<p style="text-align:center">&mdash; OR &mdash;</p><p>'
				+ '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>'
				+ '<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>'
				+ '<input type="text" name="new_attachment" id="new_attachment" placeholder="New Attachment name..." />'
				+ '<p style="text-align:center">&mdash; OR &mdash;</p><p>'
                + '<input type="text" name="external_attachment" id="external_attachment" placeholder="http:// (URI of an Attachment to download)"/></p>',
			ok: 'Create Attachment',
			id: 'new_attachment_button',
			callback: function() {
				var uploadInput = $('upload_attachment'),
					createInput = $('new_attachment'),
                    externalInput = $('external_attachment'),
					filename = createInput.value,
                    url = externalInput.value,
					renameAfterLoad,
                    files = uploadInput.files;

                if (url && !filename) {
                    // extract filename from URL
                    url_o = new URI(url);
                    filename = url_o.get('file')
                }
				
				//validation
				if(!(files && files.length) && !filename && !(url && filename)) {
					fd.error.alert('No file was selected.', 
                            'Please select a file to upload.');
					return;
				}
				
				for (var f = 0; f < files.length; f++){
					var fname = files[f].name.getFileName(),
						ex = files[f].name.getFileExtension();
						
					if (Attachment.exists(fname, ex)) {
						fd.error.alert('Filename has to be unique', 
                                'You already have an attachment with that name.');
						return;
					}
				}
				
				//if passed a folder to put the file in
				if (filename) {
				    filename = path + filename;
				} else if (path) {
				    renameAfterLoad = function(att) {
				        var el = that.getBranchFromFile(att);
				        if (el) {
				            el.destroy();
				        }

						var new_name = path + att.options.filename;
				        // rename attachment (quietly) to place in the right
                        // folder 
				        pack.renameAttachment(att.options.uid, new_name, true);
				    };
				}
				
				if (filename && filename[filename.length-1] == '/') {
					isFolder = true;
					filename = filename.substr(0, filename.length-1);
				}
				
				//remove janky characters from filenames
				if (filename) {
				    filename = filename.replace(/[^a-zA-Z0-9=!@#\$%\^&\(\)\+\-_\/\.]+/g, '-');
				    filename = filename.replace(/\/{2,}/g, '/');
				    filename = filename.replace(/^\//, '');
				    filename = filename.replace(/\/*$/g, ''); /* */
				    
				    if (!isFolder && !filename.getFileExtension()) {
                        // we're defaulting to .js files if the user doesnt 
                        // enter an extension
				        filename = filename.replace(/\./, '') + '.js'; 
				    }
                    // basename should have a meaning after replacing all
                    // non alphanumeric characters
                    if (['-', ''].contains(filename.get_basename(isFolder))) {
                        fd.error.alert(
                                'ERROR',
                                'Please use alphanumeric characters for filename');
                        return;
                    }
				}
				
				if(files.length) {
					pack.uploadAttachment(uploadInput.files, renameAfterLoad);
				} else if (isFolder) {
					pack.addFolder(filename, Folder.ROOT_DIR_DATA);
				} else if (url && filename) {
                    pack.addExternalAttachment(url, filename);
                } else if (filename) {
					pack.addAttachment(filename);
				} 				
			}
		});
		
		//hookup File / Folder buttons
		var fileBtn = $('new_type_file'),
			folderBtn = $('new_type_folder'),
			isFolder = false;
			
		fileBtn.addEvent('click', function(e) {
			e.stop();
			folderBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = false;
		});
		
		folderBtn.addEvent('click', function(e) {
			e.stop();
			fileBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = true;
		});
	},
	
	promptPlugin: function() {
		var prompt = fd.showQuestion({
			title: 'Add a Library',
			message: '<input type="text" name="new_library" id="new_library" placeholder="Search for libraries to include" />' +
					 '<input type="hidden" name="library_id_number" id="library_id_number" />',
			ok: 'Add Library',
			id: 'new_library_button',
			callback: function() {
				var lib_id = $('library_id_number').value;
				if(!lib_id) {
					fd.error.alert('No Library found!', 'Please enter the name of an existing Library');
					return;
				}
				
				fd.getItem().assignLibrary(lib_id)
				prompt.destroy();
			}
		});
		
		//setup Library autocomplete
		// autocomplete
		var ac = new FlightDeck.Autocomplete({
			'url': settings.library_autocomplete_url
		});
		$(prompt).retrieve('dragger').addEvent('drag', function(el, evt) {
			ac.positionNextTo();
		});
	},

    setPluginUpdate: function(library, latest_revision) {
        var branch = this.getBranchFromFile(library);
        if (!branch || branch.hasClass('update')) return;
		
		branch.addClass('update');
        branch.getElement('.icon').set('title', 'Update to new version');
    },
	
	removePluginUpdate: function(library) {
		var branch = this.getBranchFromFile(library);
        if (!branch || !branch.hasClass('update')) return;
		
		branch.removeClass('update');
        branch.getElement('.icon').erase('title');
	},
	
	promptPluginUpdate: function(li) {
		var that = this,
			file = li.retrieve('file');
		fd.item.updateLibrary(file, function(response) {
			that.removePluginUpdate(file);
            // XXX: Somehow here rename the item
            // $log(li);
            // $log(response);
		});
	},
	
    focus: function() {
        this.keyboard.activate();
        
        $(this).getElements('.focused').removeClass('focused');

        //set top most branch as current if never focused before
        this._current_focus = this._current_focus || $(this).getElement('li');

        if (this._current_focus) {
            this._current_focus.addClass('focused');
        }
    },

    blur: function() {
        this.keyboard.deactivate();
        if (this._current_focus) {
            this._current_focus.removeClass('focused');
        }
    },

    focusPrevious: function() {
        var current = this._current_focus,
            el;

        if (!current) {
            this.focus();
            return;
        }
        //sorta opposite for "next"
        //1. if previous sibling has children
        //2. previous sibling
        //3. parent
		el = current.getElements('!+li ul:visible !^li, !+li, !li, !section !+ section ul:visible !^li');
		
		// Here, here!
		// Since there are multiple expressions (the commas), Slick sorts the
		// returned nodelist based on placement in the document. Since we're
		// going up the dom, and basically want the *lowest* li, we can pick
		// that off the end, and everything works. Heyyy!
		el = el[el.length-1];

        if (el) {
            this._current_focus = el;
            this.focus();
        }
    },

    focusNext: function() {
        var current  = this._current_focus,
            el;
        if (!current) {
            this.focus();
            return;
        }

        //try to find the next branch that isn't hidden
        //1. Is this branch open, and have children?
        //2. Does this branch have siblings?
		el = current.getElement('ul:visible li, ~ li, !li + li, !section + section li.top_branch');
        if (el) {
            this._current_focus = el;
            this.focus();
        }

    },
	
	expandFocused: function() {
		var current  = this._current_focus;
        if (!current) {
            return;
        }
		
		var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
		this.trees[treeName].collapse.expand(current);
	},
	
	collapseFocused: function() {
		var current  = this._current_focus;
        if (!current) {
            return;
        }
		var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
		this.trees[treeName].collapse.collapse(current);
	},
	
	toggleFocused: function() {
		var current  = this._current_focus;
        if (!current) {
            return;
        }
		var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
		this.trees[treeName].collapse.toggle(current);
	},

    bind_keyboard: function() {
        var that = this;
        this.keyboard = new FlightDeck.Keyboard();
		this.keyboard.addShortcuts({
            'collapse': {
                keys:'left',
				description: 'Collapse focused folder.',
				handler: function(e) {
					if(that._current_focus) {
						var rel = that._current_focus.get('rel');
						if(rel != 'file' && !(!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
							that.collapseFocused();
						} 
					}
                }
			},
			'expand': {
                keys: 'right',
				description: 'Expand focused folder',
				handler: function(e) {
					if(that._current_focus) {
						var rel = that._current_focus.get('rel');
						if(rel != 'file' && !(!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
							that.expandFocused();
						} 
					}
                }
			},
			'up': {
                keys: 'up|k',
				description: 'Move focus up the tree.',
				handler: function(e) {
                    that.focusPrevious(); 
                }
			},
			'down': {
                keys: 'down|j',
				description: 'Move focus down the tree',
				handler: function(e) {
                    that.focusNext();
                }
			},
			'open': {
                keys: 'enter',
				description: 'Open currently focused file.',
				handler: function(e) {
					if(that._current_focus) {
						var rel = that._current_focus.get('rel');
						if(rel == 'file' || (!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
							that.selectFile(that._current_focus);
						} else {
							that.toggleFocused();
						}
					}
                }
            } 
        });
		
    },

	toElement: function() {
		return this.element;
	}
	
});

});
define('editor/views/FileTree', [], function(require, exports, module){
var /*Class = require('shipyard/class'),
	shipyard/class only lets Class extends from other shipyard/class, 
	and FileTree extends from Tree (which is a regular Moo Class)
	*/
	object = require('shipyard/utils/object');

// globals: Class, Tree, Collapse.LocalStorage, Element, String.implement

var FileTree = module.exports = new Class({
	
	Extends: Tree,
	
	options: {
		branch: {
			'rel': 'file',
			'title': 'Untitled',
			'id': null,
			'class': ''
		},
		editable: true,
		actions: {
			//add: false,
			//edit: false,
			//remove: false
		},
		snap: 3,
		id_prefix: '',
		
		// if container is null, container will default to the Tree el
		// "false" will cancel the container
		container: true,
		//onAddBranch: function(el, attributes, target){}
		//onRenameStart: function(li, span){}
		//onRenameComplete: function(li, span){}
		//onDeleteBranch: function(li, span){}
	},
	
	initialize: function(element, options) {
		this.addEvent('change', function() {
			this.setFullPath(this.current);
		}, true);
		this.parent(element, options);
	},
	
	attach: function(){
		this.parent();
		var that = this;
		this.element.addEvents({
			'mousedown:relay(.actions .edit)': function(e) {
				var li = e.target.getParent('li');
				if (li.hasClass('editing')) {
	    			that.renameBranchEnd($(e.target).getParent('li'));
				} else {
    				that.renameBranch($(e.target).getParent('li'));
				}
				
				
			},
			'click:relay(li[rel="directory"] > .holder .label, li[rel="directory"] > .holder .icon)': function(e, labelEl){
				var li = e.target.getParent('li');
				that.toggleBranch(li);
			},
			'keypress:relay(span)': function(e){
				if(e.key == 'enter') that.renameBranchEnd($(e.target).getParent('li'));
			}
		});
		
		return this;
	},
	
	mousedown: function(element, event) {
		//tree.js prevents event immediately, when really we only want
		//the event prevents when it drags. This is because if the element
		//has contentEditable active, we want the default mousedown action,
		//which is to move the cursor around the text node. If it's not,
		//then preventDefault will be called twice, and the dragging will still
		//work. :)
		
		var oldDefault = event.preventDefault;
		event.preventDefault = function(){
			event.preventDefault = oldDefault;
		};
		
		this.parent(element, event);
		if (this.clone) {
			this.clone.setStyle('display', 'none');
		}
		return this;
	},
	
	onDrag: function(el, event) {
		this.parent(el, event);
		if (this.clone) {
			this.clone.setStyle('display', null); //default snap is already 6px
		}
	},
	
	toggleBranch: function(branch) {
		if (branch && this.collapse) {
			this.collapse.toggle(branch);
		}
	},
	
	removeBranch: function(branch) {
	    var parent = branch.getParent('li');
	    
	    branch.dispose();
	    
	    if (parent && !parent.getElements('li').length && this.collapse) {
	        this.collapse.collapse(parent);
	    }
	    
	},
	
	addBranch: function(attr, target, options){
		attr = object.merge({}, this.options.branch, attr);
		target = $(target) || this.element;
		if (target.get('tag') !== 'ul') {
			target = target.getElement('ul');
		}
		
		var isEditable = this.options.editable;
		
		options = object.merge({}, {
			add: attr.rel == 'directory',
			edit: attr.rel != 'directory',
			remove: true, //can delete anything
			collapsed: true
		}, this.options.actions, options);
		
		if (!isEditable) {
		    delete options.add;
		    delete options.edit;
		    delete options.remove;
		}
		
		attr.html = ('<a class="expand" href="#"></a>' +
			'<div class="holder">' +
				'<span id="{id}" class="label" title="{title}">{title}</span><span class="icon"></span>' +
				'<div class="actions">{add}{edit}{remove}</div>' +
			'</div>{dir}').substitute({
			title: attr.title,
			id: attr.name ? attr.name + '_switch' : attr.title + '_folder',
			dir: attr.rel == 'directory' ? '<ul' + (options.collapsed ? ' style="display:none;"' : '') + '></ul>' : '',
			add: options.add ? '<span class="add" title="Add"></span>' : '',
			edit: options.edit ? '<span class="edit" title="Rename"></span>' : '',
			remove: options.remove ? '<span class="delete" title="Delete"></span>' : ''
		});
		
		var li = new Element('li', attr),
			where = 'bottom';
		
		//branches should always be in alpha order
		//so, find the place to inject the new branch
		target.getChildren('li').some(function(el) {
			if (el.get('title') > attr.title) {
				target = el;
				where = 'before';
				return true;
			}
			return false;
		});
		
		li.inject(target, where);
		this.fireEvent('addBranch', [li].combine(arguments));
		return li;
	},
	
	renameBranch: function(element, hasExtension){
		var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.get('text').trim();
		
		this.fireEvent('renameStart', [li, label]);
		
		
		label.set('tabIndex', 0).set('contenteditable', true).focus();
		li.addClass('editing');
		label.store('$text', text);
		
		label.store('$blur', function blur(e) {
			label.removeEvent('blur', blur);
			this.renameBranchCancel(element);
		}.bind(this))
		
		label.addEvent('blur', label.retrieve('$blur'))
		
		hasExtension = hasExtension || !!text.getFileExtension();
		
		var range = document.createRange(),
			node = label.firstChild;
		range.setStart(node, 0);
		range.setEnd(node, hasExtension ? text.length - text.getFileExtension().length -1 : text.length);
		sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);

		return this;
	},
	
	renameBranchCancel: function(element) {
        var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.retrieve('$text').trim();
		
		label.set('contenteditable', false);
		if (text) {
		    label.set('text', text);
		}
		label.eliminate('$text');
		li.removeClass('editing');
		
	},
	
	renameBranchEnd: function(element) {
	    var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.get('text').trim();
		
	    if(label.get('contenteditable') == 'true'){
			
			//validation
			text = text.replace(/[^a-zA-Z0-9\-_\.]+/g, '-');
		    
		    
			if (!text.getFileName()) {
			    fd.error.alert('Filename must be valid', 'Your file must not contain special characters, and requires a file extension.');
			    return this;
			}
			
			label.removeEvent('blur', label.retrieve('$blur'));
			label.eliminate('$text');
			label.set('contenteditable', false).blur();
			window.getSelection().removeAllRanges();
			
			
			li.removeClass('editing');
			//fire a renameCancel if the name didnt change
			if (text == label.get('title').trim()) {
				this.fireEvent('renameCancel', li);
				return this;
			}
			
			label.set('title', text);
			label.set('text', text);

            li.set('name', text);
			li.set('title', text);
			var path = this.getFullPath(li)
			li.set('path', path);
			
			
			this.fireEvent('renameComplete', [li, path]);
			return false;
		}
		
	},
	
	deleteBranch: function(element) {
		element.dispose();
		this.collapse.prepare();
		this.fireEvent('deleteBranch', element);
	},
	
	addPath: function(obj, options){
		options = options || {};
		var	suffix = options.suffix || '',
			splitted = obj.getFullName().split('/'),
			elements = Array.clone(splitted),
			end = splitted.length - 1,
			selector = '',
			el,
			target = options.target,
			id_prefix = this.options.id_prefix;
			
		if (id_prefix) {
		    id_prefix += '-';
		}
		
		elements.each(function(name, i){
			var path = splitted.slice(0, i + 1).join('/');
			if (i == end){
				var previous = elements[i - 1] ? elements[i - 1].getElement('ul') : (options.target.getElement('ul') || options.target);
				el = elements[i] = previous.getChildren(selector += 'li[title='+ name + suffix +'] ')[0] || this.addBranch({
					'title': obj.getShortName(),
					'name': obj.getShortName(),
					'path': path,
					'url': obj.options.url,
					'id': obj.getID(),
					'rel': obj.options.type ? 'file' : 'directory',
					'class': 'UI_File_Normal' + (options.nodrag ? ' nodrag' : '')
				}, previous, options);
				
				elements[i].store('file', obj);
			} else {
				target = elements[i] = options.target.getElement(selector += '> ul > li[title='+ name +'] ') || this.addBranch({
					'title': name,
					'name': name,
					'rel': 'directory',
					'id': id_prefix + path.replace(/\//g, '-'),
					'path': path
				}, target, options);
			}
			
		}, this);
		
		return el;
	},
	
	getFullPath: function(branch) {
		var name = branch.get('title'),
			parentEl = branch.getParent('li');
			
		if (!parentEl.hasClass('top_branch')) {
			name = this.getFullPath(parentEl) + '/' + name;
		}
		return name;
	},
	
	setFullPath: function(branch, path) {
		if (!path) path = this.getFullPath(branch);
		branch.set('path', path);
		return branch;
	},
	
	toElement: function() {
		return this.element;
	}
});

FileTree.Collapse = new Class({
	
	Extends: Collapse.LocalStorage,
	
	updateElement: function(element){
		this.parent(element);
		this.updatePath(element);
	},
	
	updatePath: function(element){
		var parent = element.getParent('li'),
			path = parent ? parent.get('path') : false;
		element.set('path', (path ? path + '/' : '') + (element.get('path') || '').split('/').getLast());
	}
	
});

String.implement('getFileExtension', function() {
    var parts = this.split('.'),
        ext = parts.pop(),
        filename = parts.join('.');
        
    return !!filename && !!ext && !ext.match(/[^a-zA-Z0-9]/) && ext;
});

String.implement('getFileName', function() {
    var ext = this.getFileExtension();
    return ext && this.substring(0, this.length - ext.length - 1);
});

});
define('editor/views/Tabs', [], function(require, exports, module){
var Class = require('shipyard/class'),
	Events = require('shipyard/class/Events'),
	Options = require('shipyard/class/Options'),
	
	object = require('shipyard/utils/object');

// globals: $, Element, Fx.Scroll

var Tab = new Class({
	
	Implements: [Events, Options],
	
	options: {
		tag: 'span',
		title: 'Untitled',
		inject: 'bottom',
		closeable: true
	},
	
	initialize: function(container, options){
		this.setOptions(options);
		
		this.container = $(container);
		
		this.element = new Element(this.options.tag, {
			'class': 'tab',
			'styles': {
				'position': 'relative',
				'display': 'inline-block',
				'cursor': 'default'
			}
		}).store('tab:instance', this).inject(this.container, this.options.inject)
        this.label = new Element('span.label', {
            'text': this.options.title
        }).inject(this.element);
		
		if (this.options.closeable) {
			this.close = new Element('span', {
				'class': 'tab-close',
				'html': 'x',
				'styles': {
					'display': 'inline-block',
					'height': 15,
					'line-height': 14,
					'margin-left': 4,
					'cursor': 'pointer'
				}
			}).inject(this.element);
		}
		
		return this;
	},
	
	destroy: function() {
		this.fireEvent('destroy');
		this.element = this.element.destroy();
		this.close = this.close.destroy();
		this.file.tab = null;
		this.file = this.container = null;
	},

    setLabel: function(text) {
        this.label.set('text', text);
    },
	
	toElement: function() {
		return this.element;
	}
	
});

var TabBar = new Class({
	
	Implements: [Events, Options],
	
	options: {
		tag: 'div',
		inject: 'top',
		scrollStart: 0,
		arrows: {
			width: 40,
			images: ['http://t3.gstatic.com/images?q=tbn:ANd9GcS0Hc6RIVSXTki0OJWsVV5d2asDioT6F9QxBB8_NjiuSSZSTJ-M', 'http://t2.gstatic.com/images?q=tbn:ANd9GcTtPqzrVe3cRKo5oryDaPhoZr2xXLV7RyV1t6QOKjD6gOW0k-Xb']
		},
		fx: {
			duration: 250,
			transition: 'circ:out',
			link: 'cancel',
			wheelStops: false
		}
	},
	
	initialize: function(element, options){
		this.setOptions(options);
		
		var bar = this,
			arrows = this.options.arrows,
			tabEvents = {};
		
		this.element = new Element('div', {
			'class': 'tab-bar',
			'styles': {
				'position': 'relative',
				'padding-left': (arrows) ? arrows.width : 0
			}
		}).inject($(element), this.options.inject);
		
		//events: Down,Up,Enter,Leave
		//targets: tab-close, everything else
		object.forEach({
			'tabDown': ['mousedown'],
			'tabUp': ['mouseup'],
			'tabEnter': ['mouseenter'],
			'tabLeave': ['mouseleave'],
			'closeDown': ['mousedown', 'tab-close'],
			'closeUp': ['mouseup', 'tab-close'],
			'closeEnter': ['mouseenter', 'tab-close'],
			'closeLeave': ['mouseleave', 'tab-close']
		}, function(val, eventName){
			var evt = val[0],
				cls = val[1] || 'tab';
			//unless otherwise specified (like tab-close), events will bubble
			//to the .tab element, and therefore still fire. This lets us
			//add a .label element, and still fire events for the whole .tab.
			tabEvents[evt + ':relay(.' + cls + ')'] = function(e){
				if((cls == 'tab' && !e.target.hasClass('tab-close'))
				   || e.target.hasClass(cls)) {
					bar.fireEvent(eventName, this, e);
				}
			};
			
			
		});
		
		this.tabs = new Element(this.options.tag, {
			'class': 'tab-container',
			'styles': {
				'overflow': 'hidden',
				'white-space': 'nowrap'
			},
			'events': tabEvents
		}).addEvent('mousewheel', function(e){
			bar.scrollTabs(['left', 'right'][e.wheel < 0 ? 0 : 1])
		}).inject(this.element);
		
		this.scroll = new Fx.Scroll(this.tabs, this.options.fx)
			.start(this.options.scrollStart, 0)
			.addEvent('complete', function(){
				this.passed = [];
			});
		
		if(arrows) {
			this.buildArrows();
		}
		
	},
	
	setSelected: function(tab) {
		$(this).getElements('.tab.selected').removeClass('selected');
		$(tab).addClass('selected');
	},
	
	buildArrows: function() {
		var arrows = this.options.arrows;
		var arrow = '<li style="float: left; width: 50%; height: 100%; opacity: 0.5; cursor: pointer; background: url(img) no-repeat center center;"></li>';
		this.arrows = new Element('ul', {
			'class': 'tab-arrows',
			'html': arrow.replace('img', arrows.images[0]) + arrow.replace('img', arrows.images[1]),
			'styles': {
				'position': 'absolute',
				'top': 0,
				'left': 0,
				'height': '100%',
				'width': arrows.width
			},
			'events': {
				'mouseenter:relay(li)': function(){
					this.set('tween', { duration: 160 }).tween('opacity', 1)
				},
				'mouseleave:relay(li)': function(){
					this.tween('opacity', 0.5)
				},
				'mousedown:relay(li)': function(e){
					this.scrollTabs(['left', 'right'][this.arrows.getChildren().indexOf(e.target)]);
				}.bind(this)
			}
		}).inject(this.element, 'top');
	},
	
	reduceTabs: function(direction){
		var tabs = this.tabs.getChildren(),
			width = this.tabs.getSize().x,
			bit = (direction == 'left') ? 1 : 0;
			
		return (bit ? tabs.reverse() : tabs).filter(function(tab, i, a){
			var coord = tab.getCoordinates(this.tabs)[direction];
			if((bit ? coord < 0 : coord > width) && !this.scroll.passed.contains(tab) || tabs.length - 1 == i) return true;
		}, this)[0];
	},
	
	scrollTabs: function(index){
		var tabs = this.tabs.getChildren(),
			tab = (typeof index == 'number') ? tabs[index.limit(0, tabs.length - 1)] : this.reduceTabs(index);	
		
		if(tab){
			this.scroll.passed.include(tab);
			this.scroll.toElementEdge(tab, this.options.axis);
		}
		
		return this;
	},
	
	toElement: function() {
		return this.tabs;
	}
	
});

exports.Tab = Tab;
exports.TabBar = TabBar;

});
document.addEventListener("DOMContentLoaded", function() {require("editor");}, false);