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
//TODO: perhaps the shipyard scripts/require should push shipyards path onto
//it automatically?
require.paths.unshift('/media/lib/shipyard/lib');
var settings = require('editor/settings');

// requiring these now so they are included in the bundle
//TODO: eventually, this file would connect Models and Views with some
// controllers
exports.Ace = require('./views/FDEditor.Ace');
exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');

var Package = require('./models/Package');
exports.package = new Package(settings)

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
define('editor/models/Package', [], function(require, exports, module){
var Class = require('shipyard/class'),
	Model = require('shipyard/model/Model'),
	fields = require('shipyard/model/fields'),
	Syncable = require('shipyard/sync/Syncable'),
	ServerSync = require('shipyard/sync/Server');

module.exports = new Class({

	Extends: Model,

	Implements: Syncable,

	Sync: {
		'default': {
			driver: ServerSync,
			route: '/packages'
		}
	},

	//pk: 'id_number',

	fields: {
		id: fields.NumberField(),
		id_number: fields.NumberField(), // the real PK?
		full_name: fields.TextField(),
		name: fields.TextField(),
		description: fields.TextField(),
		type: fields.TextField(), //ChoiceField({ choices: ['a', 'l'] })
		author: fields.TextField(),
		url: fields.TextField(),
		license: fields.TextField(),
		version_name: fields.TextField(),
		revision_number: fields.NumberField()

		// modules: FK from Module
		// attachments: FK from Attachment
		// dependencies: ManyToManyField('self')
	},

	toString: function() {
		return this.get('full_name');
	}

});

});
define('shipyard/model/Model', [], function(require, exports, module){
var Class = require('../class'),
	Events = require('../class/Events'),
	overloadSetter = require('../utils/function').overloadSetter;

var Model = module.exports = new Class({
	
	Implements: Events,

	$data: {},
	
	fields: {
		//default to always having an ID field?
	}, 
	
	initialize: function Model(data) {
		this.set(data);
	},
	
	set: overloadSetter(function set(key, value) {
		if (key in this.fields) {
			var oldValue = this.get(key);
			var newValue = this.$data[key] = this.fields[key].from(value);
			if (oldValue !== newValue) {
				this.propertyChanged(key, newValue, oldValue);
			}
		}
	}),
	
	get: function get(key) {
		if (key in this.fields) {
			return this.$data[key];
		}
		throw new Error('Accessing undefined field "'+key+'"');
	},

	propertyChanged: function propertyChanged(prop, newVal, oldVal) {
		this.fireEvent('propertyChange', prop, newVal, oldVal);
	},

	toJSON: function toJSON() {
		var data = {};
		for (var key in this.fields) {
			data[key] = this.fields[key].serialize(this.$data[key]);
		}
		return data;
	},

	toString: function toString() {
		// you should override this, since some Views will cast the
		// Model to a string when rendering
		return '[object Model]';
	}

});

});
define('shipyard/model/fields/index', [], function(require, exports, module){
exports.Field = require('./Field');
exports.BooleanField = require('./BooleanField');
exports.DateField = require('./DateField');
exports.NumberField = require('./NumberField');
exports.TextField = require('./TextField');

});
define('shipyard/model/fields/Field', [], function(require, exports, module){
var Class = require('../../class'),
    Options = require('../../class/Options');


/*
    Field: all properties on a Model are stored via the help of Fields.
    Data is stored with primitive values, but Fields can convert the data
    to useful data formats.
    
    Example: a DateField could accept a Date with it's setter, converting it
    into a string format that can be saved in a data store. The getter can
    convert the string back into a Date object, so the application can use the
    smartest object format.
*/
module.exports = new Class({
    
    Implements: Options,
    
    options: {
        'default': undefined
    },
    
    initialize: function(opts) {
        this.setOptions(opts);
    },
    
    from: function(value) {
        return value;
    },
    
    serialize: function(value) {
        if (typeof value === 'undefined') value = this.options['default'];
        if (value == null) return value;
        return this.from(value).valueOf();
	}
    
});

});
define('shipyard/model/fields/BooleanField', [], function(require, exports, module){
var Class = require('../../class'),
	Field = require('./Field'),
    typeOf = require('../../utils/type').typeOf;

var BooleanField = new Class({

	Extends: Field,

    from: function(value) {
        // this captures 1 & 0 also
        if (value == true) return true;
        if (value == false) return false;

        if (typeOf(value) == 'string') {
            var lower = value.toLowerCase();
            if (lower == 'true') return true;
            else if (lower == 'false') return false;
        }

        if (value === null) return null;

        //throw new ValidationError('Value must be either true or false')
    }

});

module.exports = function(options) {
	return new BooleanField(options);
};

});
define('shipyard/model/fields/DateField', [], function(require, exports, module){
var Class = require('../../class'),
	Field = require('./Field'),
    typeOf = require('../../utils/type').typeOf;

var DateField = new Class({

	Extends: Field,

    from: function(value) {
        if (value instanceof Date) return value;
        if (typeOf(value) == 'number') return new Date(value);

        if (value == null) return null;

        //throw new ValidationError('Value must be a date');
    }

});

module.exports = function(options) {
	return new DateField(options);
};

});
define('shipyard/model/fields/NumberField', [], function(require, exports, module){
var Class = require('../../class'),
	Field = require('./Field');

var NumberField = new Class({
	
	Extends: Field,

    from: function(value) {
        var val = parseInt(value, 10);
        if (!isNaN(val)) return val;
        else if (value == null) return null;
        
        //throw new ValidationError('Value must be numeric');
    }

});

module.exports = function(options) {
	return new NumberField(options);
};

});
define('shipyard/model/fields/TextField', [], function(require, exports, module){
var Class = require('../../class'),
	Field = require('./Field');

var TextField = new Class({

	Extends: Field,

    from: function(value) {
        if (value == null) return null;
        return String(value);
    }

});

module.exports = function(options) {
	return new TextField(options);
};

});
define('shipyard/sync/Syncable', [], function(require, exports, module){
var Class = require('../class'),
	Events = require('../class/Events'),
	object = require('../utils/object');

var DEFAULT = 'default';

function getSync(obj, name) {
	var using = name || DEFAULT,
		sync = obj.$syncs[using];

	if (!sync) 
		throw new Error('This Syncable does not have a sync named "' + using +'"')
	return sync;
}

var Syncable = new Class({
	
	Implements: Events,
	
	save: function save(options) {
		options = options || {};

		var id = this.get('id'),
			isNew = !id;

		this.fireEvent('preSave', isNew);

		var onSave = function onSave() {
			this.fireEvent('save', isNew);
		}.bind(this);

		var sync = getSync(this.constructor, options.using);
		if (isNew) {
			sync.create(this, onSave);
		} else {
			sync.update(id, this, onSave);
		}

		return this;
	},

	destroy: function destroy(options) {
		options = options || {};
		
		var id = this.get('id');
		if (!id) return null;

		this.fireEvent('preDestroy');

		var sync = getSync(this.constructor, options.using);
		sync.destroy(id, function onDelete(id) {
			this.fireEvent('destroy', id);
		}.bind(this));

		return null;
	},

	fireEvent: function fireEvent(evt) {
		// overwrite Syncable.fireEvent so that all events a syncable instances
		// fires can be observed by listening to the syncable Class
		Events.prototype.fireEvent.apply(this, arguments);

		var _class_ = this.constructor;
		var args = [].slice.call(arguments, 1);
		args.unshift(this);
		args.unshift(evt);

		_class_.fireEvent.apply(_class_, args);
	}

});

object.merge(Syncable, new Events);

Syncable.find = function find(options) {
	var klass = this;
	options = options || {};
	function wrap(rows) {
		return rows.map(function(row) { return new klass(row); });
	}

	var sync = getSync(this, options.using);

	sync.read(options.conditions || {}, function(rows) {
		rows = wrap(rows);
		if (typeof options.callback == 'function') options.callback(rows);
	});
	return this;
};

Syncable.$syncs = {};

Syncable.addSync = function addSync(name, sync) {
	this.$syncs[name] = sync;
	return this;
};

Syncable.removeSync = function removeSync(name) {
	delete this.$syncs[name];
	return this;
};


// Sync mutator

Syncable.Mutators.Sync = function Sync(syncs) {
	object.forEach(syncs, function(options, name) {
		var klass = options.driver;
		delete options.driver;
		this.addSync(name, new klass(options));
	}, this);
};

module.exports = Syncable;

});
define('shipyard/sync/Server', [], function(require, exports, module){
var Class = require('../class'),
	Sync = require('./Sync'),
	Request = require('../http/Request'),
	object = require('../utils/object'),
	string = require('../utils/string');

module.exports = new Class({

	Extends: Sync,

	options: {
		emulation: false,
		route: '',
		// each method can overwrite the default options
		create: { fragment: '/' },
		update: { fragment: '/{id}'},
		read: { fragment: '/' },
		destroy: { fragment: '/{id}' }
	},

	create: function create(data, callback) {
		this._request({
			data: data,
			callback: callback,
			method: 'POST',
			url: this._url('create')
		});
	},

	update: function update(id, data, callback) {
		this._request({
			data: data,
			callback: callback,
			method: 'PUT',
			url: this._url('update', {id: id})
		});
	},

	read: function read(params, callback) {
		this._request({
			method: 'GET',
			url: this._url('read'),
			callback: callback,
			data: params
		});
	},

	destroy: function destroy(id, callback) {
		this._request({
			method: 'DELETE',
			url: this._url('destroy', {id: id}),
			callback: callback
		});
	},

	_url: function(name, params) {
		// this needs to be able to b')ld a url based on a number of
		// different options:
		// 1. Easiest should be to declare a standard base route, ie:
		//		route: '/api/0/tasks'
		// 2. Add a fragment based on the `name` provided, ie: 
		//		'update' => '/api/0/tasks/{id}'
		// 3. Optionally, each url for `name` could be completely
		//		different and described in `this.options`.
		var url,
			base = this.getOption('route'),
			opts = this.getOption(name);
		if (!opts) 
			throw new Error('No request options for Sync action "' + name + '"');

		if (opts.route) {
			// 3.
			url = opts.route;
		} else {
			// 1.
			url = base + (opts.fragment || '');
		}

		return string.substitute(url, params);
	},

	_request: function(options) {
		var req = new Request({
			emulation: this.getOption('emulation'),
			url: options.url,
			method: options.method,
			data: options.data,
			onSuccess: function(text) {
				if (text && typeof options.callback == 'function') 
					options.callback(JSON.parse(text));
			}
		}).send();
	}

});

});
define('shipyard/sync/Sync', [], function(require, exports, module){
var Class = require('../class'),
	Options = require('../class/Options');

module.exports = new Class({

	Implements: Options,

	options: {},

	initialize: function(options) {
		this.setOptions(options)
	}

});

});
define('shipyard/http/Request', [], function(require, exports, module){
var Class = require('../class'),
	Events = require('../class/Events'),
	Options = require('../class/Options'),
	dom = require('../dom'),
	object = require('../utils/object');

var XHR;
function setXHR(xhr) {
	XHR = xhr;
}
setXHR(dom.window.get('XMLHttpRequest'));

var FormData = dom.window.get('FormData');

var Request = module.exports = exports = new Class({

	Implements: [Events, Options],

	options: {
		url: '',
		data: {},
		async: true,
		method: 'POST',
	},

	initialize: function initialize(options) {
		this.xhr = new XHR();
		this.setOptions(options);
	},

	send: function send(extraData) {
		if (this.running) return this;
		this.running = true;

		var url = this.getOption('url'),
			data = this.prepareData(extraData),
			method = this.getOption('method').toUpperCase(),
			headers = this.getOption('headers'),
			async = this.getOption('async');

		if (method == 'GET') {
			url += (~url.indexOf('?')) ? '&'+data : '?'+data;	
			data = null;
		}
		var xhr = this.xhr;
		xhr.open(method, url, async);
		xhr.onreadystatechange = this.onStateChange.bind(this);
		object.forEach(headers, function(value, key) {
			xhr.setRequestHeader(key, value);
		}, this);

		this.fireEvent('request');
		xhr.send(data);
		if (!async) this.onStateChage();

		return this;
	},

	cancel: function cancel() {
		if (!this.running) return this;
		this.running = false;
		this.xhr.abort();
		this.xhr = new XHR();
		this.fireEvent('cancel');
		return this;
	},

	isRunning: function isRunning() {
		return this.running;
	},

	prepareData: function(extra) {
		var obj = object.merge({}, this.getOption('data'), extra),
			method = this.getOption('method').toUpperCase();

		if (this.getOption('emulation') && ~['GET', 'POST'].indexOf(method)) {
			obj['_method'] = method;
			this.setOption('method', 'POST');
		}

		var data;
		if (method != 'GET' && FormData) {
			data = new FormData();
			object.forEach(obj, function(val, key) {
				data.append(key, val);
			});
		} else {
			data = object.toQueryString(obj);
		}

		return data
	},

	isSuccess: function isSuccess() {
		return (this.status >= 200) && (this.status < 300);
	},

	onStateChange: function onStateChange() {
		if (this.xhr.readyState != XHR.DONE || !this.running) return;
		this.running = false;
		this.status = 0;

		try {
			this.status = this.xhr.status;
		} catch(dontCare) {}

		if (this.isSuccess()) {
			this.response = {
				text: this.xhr.responseText, 
				xml: this.xhr.responseXML
			};
			this.fireEvent('success', this.response.text, this.response.xml);
		} else {
			this.response = { text: null, xml: null };
			this.fireEvent('failure', this.response.text, this.response.xml);
		}
		this.fireEvent('complete', this.response.text, this.response.xml);
	}

});

// expose setXHR to allow tests to inject a Mock XHR
exports.setXHR = setXHR;

});
define('shipyard/dom/index', [], function(require, exports, module){
var Class = require('../class'),
	Node = require('./Node'),
	Window = require('./Window'),
	Document = require('./Document'),
	Element = require('./Element'),
	Elements = require('./Elements'),
	Slick = require('./Slick'),
	Parser = Slick.Parser,
	Finder = Slick.Finder,
	typeOf = require('../utils/type').typeOf;

//<node>
//TODO: some monkey work to require jsdom when testing from node
var window, document;
if (typeof this.window == "undefined") {
	var jsdom = require('jsdom');
	window = jsdom.html().createWindow();
	document = window.document;
} else {
	window = this.window;
	document = this.document;
}
//</node>

var hostWindow = new Window(window);
var hostDoc = new Document(document);

var overloadNode = function overloadNode() {
	var el = select(arguments[0])
	if (el) {
		arguments[0] = el.valueOf();
		return this.parent.apply(this, arguments);
	} else {
		return this;
	}
};

var overloadMethods = ['appendChild', 'inject', 'grab', 'replace'];
var DOMElement = new Class({

	Extends: Element,

	Matches: '*', // so that his comes before the origin Element

	initialize: function DOMElement(node, options) {
		var type = typeOf(node);
		if (type == 'string') node = hostDoc.createElement(node).valueOf();
		this.parent(node, options);
	}
	
});

overloadMethods.forEach(function(methodName) {
	DOMElement.implement(methodName, overloadNode);
});


// $ and $$



var select = function(node){
	if (node != null){
		if (typeof node == 'string') return hostDoc.find('#'+node);
		if (node instanceof Node) return node;
		if (node === window) return hostWindow;
		if (node === document) return hostDoc;
		if (node.toElement) return node.toElement();
		return DOMElement.wrap(node);
	}
	return null;
};



var collect = function(){
	var list = [];
	for (var i = 0; i < arguments.length; i++) {
		var arg = arguments[i],
			type = typeOf(arg);

		if (type == 'string') list = list.concat(hostDoc.search(arg));
		else list.push(arg);
	}
	return new Elements(list);
};

if (!document.body) throw new Error("document.body doesn't exist yet.");
hostDoc.body = new DOMElement(document.body);
//hostDoc.head = new DOMElement(document.getElementsByTagName('head')[0]);


exports.window = hostWindow;
exports.document = hostDoc;
exports.Element = DOMElement;
exports.Elements = Elements;
exports.$ = exports.select = select;
exports.$$ = exports.collect = collect;

});
define('shipyard/dom/Node', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('../class'),
	typeOf = require('../utils/type').typeOf,
	object = require('../utils/object'),
	lazy = require('../utils/function').lazy,
	Slick = require('./Slick'),
	Finder = Slick.Finder;


var Node = new Class({

	initialize: function Node(node) {
		this.node = node;
		wrappers[Finder.uidOf(node)] = this;
	},
	
	find: function(expression) {
		return Node.wrap(Finder.find(this.node, expression));
	},
	
	search: function(expression) {
		var nodes = Finder.search(this.node, expression);
		for (var i = 0; i < nodes.length; i++) nodes[i] = Node.wrap(nodes[i]);
		return nodes;
	}

});

Node.prototype.valueOf = function(){
	return this.node;
};


var wrappers = {}, matchers = [];

Node.Mutators.Matches = function(match){
	matchers.push({_match: match, _class: this});
};

Node.wrap = function(node) {
	if (node == null) return null;
	var uid = Finder.uidOf(node), wrapper = wrappers[uid];
	if (wrapper) return wrapper;
	for (var l = matchers.length; l--; l){
		var current = matchers[l];
		if (Finder.match(node, current._match)) 
			return (new current._class(node));
	}

};



// Event Listeners

function addEventListener(type, fn) {
	this.node.addEventListener(type, fn, false);
	return this;
}

function attachEvent(type, fn) {
	this.node.attachEvent('on' + type, fn);
	return this;
}

function removeEventListner(type, fn) {
	this.node.removeEventListener(type, fn, false);
	return this;
}

function detachEvent(type, fn) {
	this.node.detachEvent('on' + type, fn);
	return this;
}

lazy(Node.prototype, 'addEvent', function() {
	return this.node.addEventListener ? addEventListener : attachEvent;
});

lazy(Node.prototype, 'removeEvent', function() {
	return this.node.removeEventListener ? removeEventListener : detachEvent;
});


module.exports = Node;

});
define('shipyard/dom/Slick/index', [], function(require, exports, module){
exports.Finder = require('./Finder');
exports.Parser = require('./Parser');

});
define('shipyard/dom/Slick/Finder', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Parser = require('./Parser');
	
var Finder = {}, local = {},
	featuresCache = {},
	toString = Object.prototype.toString;

// Feature / Bug detection

local.isNativeCode = function(fn){
	return (/\{\s*\[native code\]\s*\}/).test('' + fn);
};

local.isXML = function(document){
	return (!!document.xmlVersion) || (!!document.xml) || (toString.call(document) == '[object XMLDocument]') ||
	(document.nodeType == 9 && document.documentElement.nodeName != 'HTML');
};

local.setDocument = function(document){

	// convert elements / window arguments to document. if document cannot be extrapolated, the function returns.
	var nodeType = document.nodeType;
	if (nodeType == 9); // document
	else if (nodeType) document = document.ownerDocument; // node
	else if (document.navigator) document = document.document; // window
	else return;

	// check if it's the old document

	if (this.document === document) return;
	this.document = document;

	// check if we have done feature detection on this document before

	var root = document.documentElement,
		rootUid = this.getUIDXML(root),
		features = featuresCache[rootUid],
		feature;

	if (features){
		for (feature in features){
			this[feature] = features[feature];
		}
		return;
	}

	features = featuresCache[rootUid] = {};

	features.root = root;
	features.isXMLDocument = this.isXML(document);

	features.brokenStarGEBTN
	= features.starSelectsClosedQSA
	= features.idGetsName
	= features.brokenMixedCaseQSA
	= features.brokenGEBCN
	= features.brokenCheckedQSA
	= features.brokenEmptyAttributeQSA
	= features.isHTMLDocument
	= features.nativeMatchesSelector
	= false;

	var starSelectsClosed, starSelectsComments,
		brokenSecondClassNameGEBCN, cachedGetElementsByClassName,
		brokenFormAttributeGetter;

	var selected, id = 'slick_uniqueid';
	var testNode = document.createElement('div');
	
	var testRoot = document.body || document.getElementsByTagName('body')[0] || root;
	testRoot.appendChild(testNode);

	// on non-HTML documents innerHTML and getElementsById doesnt work properly
	try {
		testNode.innerHTML = '<a id="'+id+'"></a>';
		features.isHTMLDocument = !!document.getElementById(id);
	} catch(e){};

	if (features.isHTMLDocument){

		testNode.style.display = 'none';

		// IE returns comment nodes for getElementsByTagName('*') for some documents
		testNode.appendChild(document.createComment(''));
		starSelectsComments = (testNode.getElementsByTagName('*').length > 1);

		// IE returns closed nodes (EG:"</foo>") for getElementsByTagName('*') for some documents
		try {
			testNode.innerHTML = 'foo</foo>';
			selected = testNode.getElementsByTagName('*');
			starSelectsClosed = (selected && !!selected.length && selected[0].nodeName.charAt(0) == '/');
		} catch(e){};

		features.brokenStarGEBTN = starSelectsComments || starSelectsClosed;

		// IE returns elements with the name instead of just id for getElementsById for some documents
		try {
			testNode.innerHTML = '<a name="'+ id +'"></a><b id="'+ id +'"></b>';
			features.idGetsName = document.getElementById(id) === testNode.firstChild;
		} catch(e){};

		if (testNode.getElementsByClassName){

			// Safari 3.2 getElementsByClassName caches results
			try {
				testNode.innerHTML = '<a class="f"></a><a class="b"></a>';
				testNode.getElementsByClassName('b').length;
				testNode.firstChild.className = 'b';
				cachedGetElementsByClassName = (testNode.getElementsByClassName('b').length != 2);
			} catch(e){};

			// Opera 9.6 getElementsByClassName doesnt detects the class if its not the first one
			try {
				testNode.innerHTML = '<a class="a"></a><a class="f b a"></a>';
				brokenSecondClassNameGEBCN = (testNode.getElementsByClassName('a').length != 2);
			} catch(e){};

			features.brokenGEBCN = cachedGetElementsByClassName || brokenSecondClassNameGEBCN;
		}
		
		if (testNode.querySelectorAll){
			// IE 8 returns closed nodes (EG:"</foo>") for querySelectorAll('*') for some documents
			try {
				testNode.innerHTML = 'foo</foo>';
				selected = testNode.querySelectorAll('*');
				features.starSelectsClosedQSA = (selected && !!selected.length && selected[0].nodeName.charAt(0) == '/');
			} catch(e){};

			// Safari 3.2 querySelectorAll doesnt work with mixedcase on quirksmode
			try {
				testNode.innerHTML = '<a class="MiX"></a>';
				features.brokenMixedCaseQSA = !testNode.querySelectorAll('.MiX').length;
			} catch(e){};

			// Webkit and Opera dont return selected options on querySelectorAll
			try {
				testNode.innerHTML = '<select><option selected="selected">a</option></select>';
				features.brokenCheckedQSA = (testNode.querySelectorAll(':checked').length == 0);
			} catch(e){};

			// IE returns incorrect results for attr[*^$]="" selectors on querySelectorAll
			try {
				testNode.innerHTML = '<a class=""></a>';
				features.brokenEmptyAttributeQSA = (testNode.querySelectorAll('[class*=""]').length != 0);
			} catch(e){};

		}

		// IE6-7, if a form has an input of id x, form.getAttribute(x) returns a reference to the input
		try {
			testNode.innerHTML = '<form action="s"><input id="action"/></form>';
			brokenFormAttributeGetter = (testNode.firstChild.getAttribute('action') != 's');
		} catch(e){};

		// native matchesSelector function

		features.nativeMatchesSelector = root.matchesSelector || /*root.msMatchesSelector ||*/ root.mozMatchesSelector || root.webkitMatchesSelector;
		if (features.nativeMatchesSelector) try {
			// if matchesSelector trows errors on incorrect sintaxes we can use it
			features.nativeMatchesSelector.call(root, ':slick');
			features.nativeMatchesSelector = null;
		} catch(e){};

	}

	try {
		root.slick_expando = 1;
		delete root.slick_expando;
		features.getUID = this.getUIDHTML;
	} catch(e) {
		features.getUID = this.getUIDXML;
	}

	testRoot.removeChild(testNode);
	testNode = selected = testRoot = null;

	// getAttribute

	features.getAttribute = (features.isHTMLDocument && brokenFormAttributeGetter) ? function(node, name){
		var method = this.attributeGetters[name];
		if (method) return method.call(node);
		var attributeNode = node.getAttributeNode(name);
		return (attributeNode) ? attributeNode.nodeValue : null;
	} : function(node, name){
		var method = this.attributeGetters[name];
		return (method) ? method.call(node) : node.getAttribute(name);
	};

	// hasAttribute

	features.hasAttribute = (root && this.isNativeCode(root.hasAttribute)) ? function(node, attribute) {
		return node.hasAttribute(attribute);
	} : function(node, attribute) {
		node = node.getAttributeNode(attribute);
		return !!(node && (node.specified || node.nodeValue));
	};

	// contains
	// FIXME: Add specs: local.contains should be different for xml and html documents?
	features.contains = (root && this.isNativeCode(root.contains)) ? function(context, node){
		return context.contains(node);
	} : (root && root.compareDocumentPosition) ? function(context, node){
		return context === node || !!(context.compareDocumentPosition(node) & 16);
	} : function(context, node){
		if (node) do {
			if (node === context) return true;
		} while ((node = node.parentNode));
		return false;
	};

	// document order sorting
	// credits to Sizzle (http://sizzlejs.com/)

	features.documentSorter = (root.compareDocumentPosition) ? function(a, b){
		if (!a.compareDocumentPosition || !b.compareDocumentPosition) return 0;
		return a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
	} : ('sourceIndex' in root) ? function(a, b){
		if (!a.sourceIndex || !b.sourceIndex) return 0;
		return a.sourceIndex - b.sourceIndex;
	} : (document.createRange) ? function(a, b){
		if (!a.ownerDocument || !b.ownerDocument) return 0;
		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		return aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
	} : null ;

	root = null;

	for (feature in features){
		this[feature] = features[feature];
	}
};

// Main Method

var reSimpleSelector = /^([#.]?)((?:[\w-]+|\*))$/,
	reEmptyAttribute = /\[.+[*$^]=(?:""|'')?\]/,
	qsaFailExpCache = {};

local.search = function(context, expression, append, first){

	var found = this.found = (first) ? null : (append || []);
	
	if (!context) return found;
	else if (context.navigator) context = context.document; // Convert the node from a window to a document
	else if (!context.nodeType) return found;

	// setup

	var parsed, i,
		uniques = this.uniques = {},
		hasOthers = !!(append && append.length),
		contextIsDocument = (context.nodeType == 9);

	if (this.document !== (contextIsDocument ? context : context.ownerDocument)) this.setDocument(context);

	// avoid duplicating items already in the append array
	if (hasOthers) for (i = found.length; i--;) uniques[this.getUID(found[i])] = true;

	// expression checks

	if (typeof expression == 'string'){ // expression is a string

		/*<simple-selectors-override>*/
		var simpleSelector = expression.match(reSimpleSelector);
		simpleSelectors: if (simpleSelector) {

			var symbol = simpleSelector[1],
				name = simpleSelector[2],
				node, nodes;

			if (!symbol){

				if (name == '*' && this.brokenStarGEBTN) break simpleSelectors;
				nodes = context.getElementsByTagName(name);
				if (first) return nodes[0] || null;
				for (i = 0; node = nodes[i++];){
					if (!(hasOthers && uniques[this.getUID(node)])) found.push(node);
				}

			} else if (symbol == '#'){

				if (!this.isHTMLDocument || !contextIsDocument) break simpleSelectors;
				node = context.getElementById(name);
				if (!node) return found;
				if (this.idGetsName && node.getAttributeNode('id').nodeValue != name) break simpleSelectors;
				if (first) return node || null;
				if (!(hasOthers && uniques[this.getUID(node)])) found.push(node);

			} else if (symbol == '.'){

				if (!this.isHTMLDocument || ((!context.getElementsByClassName || this.brokenGEBCN) && context.querySelectorAll)) break simpleSelectors;
				if (context.getElementsByClassName && !this.brokenGEBCN){
					nodes = context.getElementsByClassName(name);
					if (first) return nodes[0] || null;
					for (i = 0; node = nodes[i++];){
						if (!(hasOthers && uniques[this.getUID(node)])) found.push(node);
					}
				} else {
					var matchClass = new RegExp('(^|\\s)'+ Parser.escapeRegExp(name) +'(\\s|$)');
					nodes = context.getElementsByTagName('*');
					for (i = 0; node = nodes[i++];){
						className = node.className;
						if (!(className && matchClass.test(className))) continue;
						if (first) return node;
						if (!(hasOthers && uniques[this.getUID(node)])) found.push(node);
					}
				}

			}

			if (hasOthers) this.sort(found);
			return (first) ? null : found;

		}
		/*</simple-selectors-override>*/

		/*<query-selector-override>*/
		querySelector: if (context.querySelectorAll) {

			if (!this.isHTMLDocument || this.brokenMixedCaseQSA || qsaFailExpCache[expression] ||
			(this.brokenCheckedQSA && expression.indexOf(':checked') > -1) ||
			(this.brokenEmptyAttributeQSA && reEmptyAttribute.test(expression)) || Finder.disableQSA) break querySelector;

			var _expression = expression;
			if (!contextIsDocument){
				// non-document rooted QSA
				// credits to Andrew Dupont
				var currentId = context.getAttribute('id'), slickid = 'slickid__';
				context.setAttribute('id', slickid);
				_expression = '#' + slickid + ' ' + _expression;
			}

			try {
				if (first) return context.querySelector(_expression) || null;
				else nodes = context.querySelectorAll(_expression);
			} catch(e) {
				qsaFailExpCache[expression] = 1;
				break querySelector;
			} finally {
				if (!contextIsDocument){
					if (currentId) context.setAttribute('id', currentId);
					else context.removeAttribute('id');
				}
			}

			if (this.starSelectsClosedQSA) for (i = 0; node = nodes[i++];){
				if (node.nodeName > '@' && !(hasOthers && uniques[this.getUID(node)])) found.push(node);
			} else for (i = 0; node = nodes[i++];){
				if (!(hasOthers && uniques[this.getUID(node)])) found.push(node);
			}

			if (hasOthers) this.sort(found);
			return found;

		}
		/*</query-selector-override>*/

		parsed = Parser.parse(expression);
		if (!parsed.length) return found;
	} else if (expression == null){ // there is no expression
		return found;
	} else if (expression.Slick){ // expression is a parsed Slick object
		parsed = expression;
	} else if (this.contains(context.documentElement || context, expression)){ // expression is a node
		(found) ? found.push(expression) : found = expression;
		return found;
	} else { // other junk
		return found;
	}

	/*<pseudo-selectors>*//*<nth-pseudo-selectors>*/

	// cache elements for the nth selectors

	this.posNTH = {};
	this.posNTHLast = {};
	this.posNTHType = {};
	this.posNTHTypeLast = {};

	/*</nth-pseudo-selectors>*//*</pseudo-selectors>*/

	// if append is null and there is only a single selector with one expression use pushArray, else use pushUID
	this.push = (!hasOthers && (first || (parsed.length == 1 && parsed.expressions[0].length == 1))) ? this.pushArray : this.pushUID;

	if (found == null) found = [];

	// default engine

	var j, m, n;
	var combinator, tag, id, classList, classes, attributes, pseudos;
	var currentItems, currentExpression, currentBit, lastBit, expressions = parsed.expressions;

	search: for (i = 0; (currentExpression = expressions[i]); i++) for (j = 0; (currentBit = currentExpression[j]); j++){

		combinator = 'combinator:' + currentBit.combinator;
		if (!this[combinator]) continue search;

		tag        = (this.isXMLDocument) ? currentBit.tag : currentBit.tag.toUpperCase();
		id         = currentBit.id;
		classList  = currentBit.classList;
		classes    = currentBit.classes;
		attributes = currentBit.attributes;
		pseudos    = currentBit.pseudos;
		lastBit    = (j === (currentExpression.length - 1));

		this.bitUniques = {};

		if (lastBit){
			this.uniques = uniques;
			this.found = found;
		} else {
			this.uniques = {};
			this.found = [];
		}

		if (j === 0){
			this[combinator](context, tag, id, classes, attributes, pseudos, classList);
			if (first && lastBit && found.length) break search;
		} else {
			if (first && lastBit) for (m = 0, n = currentItems.length; m < n; m++){
				this[combinator](currentItems[m], tag, id, classes, attributes, pseudos, classList);
				if (found.length) break search;
			} else for (m = 0, n = currentItems.length; m < n; m++) this[combinator](currentItems[m], tag, id, classes, attributes, pseudos, classList);
		}

		currentItems = this.found;
	}

	// should sort if there are nodes in append and if you pass multiple expressions.
	if (hasOthers || (parsed.expressions.length > 1)) this.sort(found);

	return (first) ? (found[0] || null) : found;
};

// Utils

local.uidx = 1;
local.uidk = 'slick-uniqueid';

local.getUIDXML = function(node){
	var uid = node.getAttribute(this.uidk);
	if (!uid){
		uid = this.uidx++;
		node.setAttribute(this.uidk, uid);
	}
	return uid;
};

local.getUIDHTML = function(node){
	return node.uniqueNumber || (node.uniqueNumber = this.uidx++);
};

// sort based on the setDocument documentSorter method.

local.sort = function(results){
	if (!this.documentSorter) return results;
	results.sort(this.documentSorter);
	return results;
};

/*<pseudo-selectors>*//*<nth-pseudo-selectors>*/

local.cacheNTH = {};

local.matchNTH = /^([+-]?\d*)?([a-z]+)?([+-]\d+)?$/;

local.parseNTHArgument = function(argument){
	var parsed = argument.match(this.matchNTH);
	if (!parsed) return false;
	var special = parsed[2] || false;
	var a = parsed[1] || 1;
	if (a == '-') a = -1;
	var b = +parsed[3] || 0;
	parsed =
		(special == 'n')	? {a: a, b: b} :
		(special == 'odd')	? {a: 2, b: 1} :
		(special == 'even')	? {a: 2, b: 0} : {a: 0, b: a};

	return (this.cacheNTH[argument] = parsed);
};

local.createNTHPseudo = function(child, sibling, positions, ofType){
	return function(node, argument){
		var uid = this.getUID(node);
		if (!this[positions][uid]){
			var parent = node.parentNode;
			if (!parent) return false;
			var el = parent[child], count = 1;
			if (ofType){
				var nodeName = node.nodeName;
				do {
					if (el.nodeName != nodeName) continue;
					this[positions][this.getUID(el)] = count++;
				} while ((el = el[sibling]));
			} else {
				do {
					if (el.nodeType != 1) continue;
					this[positions][this.getUID(el)] = count++;
				} while ((el = el[sibling]));
			}
		}
		argument = argument || 'n';
		var parsed = this.cacheNTH[argument] || this.parseNTHArgument(argument);
		if (!parsed) return false;
		var a = parsed.a, b = parsed.b, pos = this[positions][uid];
		if (a == 0) return b == pos;
		if (a > 0){
			if (pos < b) return false;
		} else {
			if (b < pos) return false;
		}
		return ((pos - b) % a) == 0;
	};
};

/*</nth-pseudo-selectors>*//*</pseudo-selectors>*/

local.pushArray = function(node, tag, id, classes, attributes, pseudos){
	if (this.matchSelector(node, tag, id, classes, attributes, pseudos)) this.found.push(node);
};

local.pushUID = function(node, tag, id, classes, attributes, pseudos){
	var uid = this.getUID(node);
	if (!this.uniques[uid] && this.matchSelector(node, tag, id, classes, attributes, pseudos)){
		this.uniques[uid] = true;
		this.found.push(node);
	}
};

local.matchNode = function(node, selector){
	if (this.isHTMLDocument && this.nativeMatchesSelector){
		try {
			return this.nativeMatchesSelector.call(node, selector.replace(/\[([^=]+)=\s*([^'"\]]+?)\s*\]/g, '[$1="$2"]'));
		} catch(matchError) {}
	}
	
	var parsed = Parser.parse(selector);
	if (!parsed) return true;

	// simple (single) selectors
	var expressions = parsed.expressions, reversedExpressions, simpleExpCounter = 0, i;
	for (i = 0; (currentExpression = expressions[i]); i++){
		if (currentExpression.length == 1){
			var exp = currentExpression[0];
			if (this.matchSelector(node, (this.isXMLDocument) ? exp.tag : exp.tag.toUpperCase(), exp.id, exp.classes, exp.attributes, exp.pseudos)) return true;
			simpleExpCounter++;
		}
	}

	if (simpleExpCounter == parsed.length) return false;

	var nodes = this.search(this.document, parsed), item;
	for (i = 0; item = nodes[i++];){
		if (item === node) return true;
	}
	return false;
};

local.matchPseudo = function(node, name, argument){
	var pseudoName = 'pseudo:' + name;
	if (this[pseudoName]) return this[pseudoName](node, argument);
	var attribute = this.getAttribute(node, name);
	return (argument) ? argument == attribute : !!attribute;
};

local.matchSelector = function(node, tag, id, classes, attributes, pseudos){
	if (tag){
		var nodeName = (this.isXMLDocument) ? node.nodeName : node.nodeName.toUpperCase();
		if (tag == '*'){
			if (nodeName < '@') return false; // Fix for comment nodes and closed nodes
		} else {
			if (nodeName != tag) return false;
		}
	}

	if (id && node.getAttribute('id') != id) return false;

	var i, part, cls;
	if (classes) for (i = classes.length; i--;){
		cls = node.getAttribute('class') || node.className;
		if (!(cls && classes[i].regexp.test(cls))) return false;
	}
	if (attributes) for (i = attributes.length; i--;){
		part = attributes[i];
		if (part.operator ? !part.test(this.getAttribute(node, part.key)) : !this.hasAttribute(node, part.key)) return false;
	}
	if (pseudos) for (i = pseudos.length; i--;){
		part = pseudos[i];
		if (!this.matchPseudo(node, part.key, part.value)) return false;
	}
	return true;
};

var combinators = {

	' ': function(node, tag, id, classes, attributes, pseudos, classList){ // all child nodes, any level

		var i, item, children;

		if (this.isHTMLDocument){
			getById: if (id){
				item = this.document.getElementById(id);
				if ((!item && node.all) || (this.idGetsName && item && item.getAttributeNode('id').nodeValue != id)){
					// all[id] returns all the elements with that name or id inside node
					// if theres just one it will return the element, else it will be a collection
					children = node.all[id];
					if (!children) return;
					if (!children[0]) children = [children];
					for (i = 0; item = children[i++];){
						var idNode = item.getAttributeNode('id');
						if (idNode && idNode.nodeValue == id){
							this.push(item, tag, null, classes, attributes, pseudos);
							break;
						}
					} 
					return;
				}
				if (!item){
					// if the context is in the dom we return, else we will try GEBTN, breaking the getById label
					if (this.contains(this.root, node)) return;
					else break getById;
				} else if (this.document !== node && !this.contains(node, item)) return;
				this.push(item, tag, null, classes, attributes, pseudos);
				return;
			}
			getByClass: if (classes && node.getElementsByClassName && !this.brokenGEBCN){
				children = node.getElementsByClassName(classList.join(' '));
				if (!(children && children.length)) break getByClass;
				for (i = 0; item = children[i++];) this.push(item, tag, id, null, attributes, pseudos);
				return;
			}
		}
		getByTag: {
			children = node.getElementsByTagName(tag);
			if (!(children && children.length)) break getByTag;
			if (!this.brokenStarGEBTN) tag = null;
			for (i = 0; item = children[i++];) this.push(item, tag, id, classes, attributes, pseudos);
		}
	},

	'>': function(node, tag, id, classes, attributes, pseudos){ // direct children
		if ((node = node.firstChild)) do {
			if (node.nodeType == 1) this.push(node, tag, id, classes, attributes, pseudos);
		} while ((node = node.nextSibling));
	},

	'+': function(node, tag, id, classes, attributes, pseudos){ // next sibling
		while ((node = node.nextSibling)) if (node.nodeType == 1){
			this.push(node, tag, id, classes, attributes, pseudos);
			break;
		}
	},

	'^': function(node, tag, id, classes, attributes, pseudos){ // first child
		node = node.firstChild;
		if (node){
			if (node.nodeType == 1) this.push(node, tag, id, classes, attributes, pseudos);
			else this['combinator:+'](node, tag, id, classes, attributes, pseudos);
		}
	},

	'~': function(node, tag, id, classes, attributes, pseudos){ // next siblings
		while ((node = node.nextSibling)){
			if (node.nodeType != 1) continue;
			var uid = this.getUID(node);
			if (this.bitUniques[uid]) break;
			this.bitUniques[uid] = true;
			this.push(node, tag, id, classes, attributes, pseudos);
		}
	},

	'++': function(node, tag, id, classes, attributes, pseudos){ // next sibling and previous sibling
		this['combinator:+'](node, tag, id, classes, attributes, pseudos);
		this['combinator:!+'](node, tag, id, classes, attributes, pseudos);
	},

	'~~': function(node, tag, id, classes, attributes, pseudos){ // next siblings and previous siblings
		this['combinator:~'](node, tag, id, classes, attributes, pseudos);
		this['combinator:!~'](node, tag, id, classes, attributes, pseudos);
	},

	'!': function(node, tag, id, classes, attributes, pseudos){ // all parent nodes up to document
		while ((node = node.parentNode)) if (node !== this.document) this.push(node, tag, id, classes, attributes, pseudos);
	},

	'!>': function(node, tag, id, classes, attributes, pseudos){ // direct parent (one level)
		node = node.parentNode;
		if (node !== this.document) this.push(node, tag, id, classes, attributes, pseudos);
	},

	'!+': function(node, tag, id, classes, attributes, pseudos){ // previous sibling
		while ((node = node.previousSibling)) if (node.nodeType == 1){
			this.push(node, tag, id, classes, attributes, pseudos);
			break;
		}
	},

	'!^': function(node, tag, id, classes, attributes, pseudos){ // last child
		node = node.lastChild;
		if (node){
			if (node.nodeType == 1) this.push(node, tag, id, classes, attributes, pseudos);
			else this['combinator:!+'](node, tag, id, classes, attributes, pseudos);
		}
	},

	'!~': function(node, tag, id, classes, attributes, pseudos){ // previous siblings
		while ((node = node.previousSibling)){
			if (node.nodeType != 1) continue;
			var uid = this.getUID(node);
			if (this.bitUniques[uid]) break;
			this.bitUniques[uid] = true;
			this.push(node, tag, id, classes, attributes, pseudos);
		}
	}

};

for (var c in combinators) local['combinator:' + c] = combinators[c];

var pseudos = {

	/*<pseudo-selectors>*/

	'empty': function(node){
		var child = node.firstChild;
		return !(child && child.nodeType == 1) && !(node.innerText || node.textContent || '').length;
	},

	'not': function(node, expression){
		return !this.matchNode(node, expression);
	},

	'contains': function(node, text){
		return (node.innerText || node.textContent || '').indexOf(text) > -1;
	},

	'first-child': function(node){
		while ((node = node.previousSibling)) if (node.nodeType == 1) return false;
		return true;
	},

	'last-child': function(node){
		while ((node = node.nextSibling)) if (node.nodeType == 1) return false;
		return true;
	},

	'only-child': function(node){
		var prev = node;
		while ((prev = prev.previousSibling)) if (prev.nodeType == 1) return false;
		var next = node;
		while ((next = next.nextSibling)) if (next.nodeType == 1) return false;
		return true;
	},

	/*<nth-pseudo-selectors>*/

	'nth-child': local.createNTHPseudo('firstChild', 'nextSibling', 'posNTH'),

	'nth-last-child': local.createNTHPseudo('lastChild', 'previousSibling', 'posNTHLast'),

	'nth-of-type': local.createNTHPseudo('firstChild', 'nextSibling', 'posNTHType', true),

	'nth-last-of-type': local.createNTHPseudo('lastChild', 'previousSibling', 'posNTHTypeLast', true),

	'index': function(node, index){
		return this['pseudo:nth-child'](node, '' + index + 1);
	},

	'even': function(node){
		return this['pseudo:nth-child'](node, '2n');
	},

	'odd': function(node){
		return this['pseudo:nth-child'](node, '2n+1');
	},

	/*</nth-pseudo-selectors>*/

	/*<of-type-pseudo-selectors>*/

	'first-of-type': function(node){
		var nodeName = node.nodeName;
		while ((node = node.previousSibling)) if (node.nodeName == nodeName) return false;
		return true;
	},

	'last-of-type': function(node){
		var nodeName = node.nodeName;
		while ((node = node.nextSibling)) if (node.nodeName == nodeName) return false;
		return true;
	},

	'only-of-type': function(node){
		var prev = node, nodeName = node.nodeName;
		while ((prev = prev.previousSibling)) if (prev.nodeName == nodeName) return false;
		var next = node;
		while ((next = next.nextSibling)) if (next.nodeName == nodeName) return false;
		return true;
	},

	/*</of-type-pseudo-selectors>*/

	// custom pseudos

	'enabled': function(node){
		return !node.disabled;
	},

	'disabled': function(node){
		return node.disabled;
	},

	'checked': function(node){
		return node.checked || node.selected;
	},

	'focus': function(node){
		return this.isHTMLDocument && this.document.activeElement === node && (node.href || node.type || this.hasAttribute(node, 'tabindex'));
	},

	'root': function(node){
		return (node === this.root);
	},
	
	'selected': function(node){
		return node.selected;
	}

	/*</pseudo-selectors>*/
};

for (var p in pseudos) local['pseudo:' + p] = pseudos[p];

// attributes methods

local.attributeGetters = {

	'class': function(){
		return this.getAttribute('class') || this.className;
	},

	'for': function(){
		return ('htmlFor' in this) ? this.htmlFor : this.getAttribute('for');
	},

	'href': function(){
		return ('href' in this) ? this.getAttribute('href', 2) : this.getAttribute('href');
	},

	'style': function(){
		return (this.style) ? this.style.cssText : this.getAttribute('style');
	},
	
	'tabindex': function(){
		var attributeNode = this.getAttributeNode('tabindex');
		return (attributeNode && attributeNode.specified) ? attributeNode.nodeValue : null;
	},

	'type': function(){
		return this.getAttribute('type');
	}

};

// Slick

Finder.version = '1.1.5';

// Slick finder

Finder.search = function(context, expression, append){
	return local.search(context, expression, append);
};

Finder.find = function(context, expression){
	return local.search(context, expression, null, true);
};

// Slick containment checker

Finder.contains = function(container, node){
	local.setDocument(container);
	return local.contains(container, node);
};

// Slick attribute getter

Finder.getAttribute = function(node, name){
	return local.getAttribute(node, name);
};

// Slick matcher

Finder.match = function(node, selector){
	if (!(node && selector)) return false;
	if (!selector || selector === node) return true;
	local.setDocument(node);
	return local.matchNode(node, selector);
};

// Slick attribute accessor

Finder.defineAttributeGetter = function(name, fn){
	local.attributeGetters[name] = fn;
	return this;
};

Finder.lookupAttributeGetter = function(name){
	return local.attributeGetters[name];
};

// Slick pseudo accessor

Finder.definePseudo = function(name, fn){
	local['pseudo:' + name] = function(node, argument){
		return fn.call(node, argument);
	};
	return this;
};

Finder.lookupPseudo = function(name){
	var pseudo = local['pseudo:' + name];
	if (pseudo) return function(argument){
		return pseudo.call(this, argument);
	};
	return null;
};

Finder.isXML = local.isXML;

Finder.uidOf = function(node){
	return local.getUIDHTML(node);
};

module.exports = Finder;

});
define('shipyard/dom/Slick/Parser', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var parsed,
	separatorIndex,
	combinatorIndex,
	reversed,
	cache = {},
	reverseCache = {},
	reUnescape = /\\/g;

var parse = function(expression, isReversed){
	if (expression == null) return null;
	if (expression.Slick === true) return expression;
	expression = ('' + expression).replace(/^\s+|\s+$/g, '');
	reversed = !!isReversed;
	var currentCache = (reversed) ? reverseCache : cache;
	if (currentCache[expression]) return currentCache[expression];
	parsed = {
		Slick: true,
		expressions: [],
		raw: expression,
		reverse: function(){
			return parse(this.raw, true);
		}
	};
	separatorIndex = -1;
	while (expression != (expression = expression.replace(regexp, parser)));
	parsed.length = parsed.expressions.length;
	return currentCache[parsed.raw] = (reversed) ? reverse(parsed) : parsed;
};

var reverseCombinator = function(combinator){
	if (combinator === '!') return ' ';
	else if (combinator === ' ') return '!';
	else if ((/^!/).test(combinator)) return combinator.replace(/^!/, '');
	else return '!' + combinator;
};

var reverse = function(expression){
	var expressions = expression.expressions;
	for (var i = 0; i < expressions.length; i++){
		var exp = expressions[i];
		var last = {parts: [], tag: '*', combinator: reverseCombinator(exp[0].combinator)};

		for (var j = 0; j < exp.length; j++){
			var cexp = exp[j];
			if (!cexp.reverseCombinator) cexp.reverseCombinator = ' ';
			cexp.combinator = cexp.reverseCombinator;
			delete cexp.reverseCombinator;
		}

		exp.reverse().push(last);
	}
	return expression;
};

var escapeRegExp = function(string){// Credit: XRegExp 0.6.1 (c) 2007-2008 Steven Levithan <http://stevenlevithan.com/regex/xregexp/> MIT License
	return string.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, function(match){
		return '\\' + match;
	});
};

var regexp = new RegExp(
/*
#!/usr/bin/env ruby
puts "\t\t" + DATA.read.gsub(/\(\?x\)|\s+#.*$|\s+|\\$|\\n/,'')
__END__
	"(?x)^(?:\
	  \\s* ( , ) \\s*               # Separator          \n\
	| \\s* ( <combinator>+ ) \\s*   # Combinator         \n\
	|      ( \\s+ )                 # CombinatorChildren \n\
	|      ( <unicode>+ | \\* )     # Tag                \n\
	| \\#  ( <unicode>+       )     # ID                 \n\
	| \\.  ( <unicode>+       )     # ClassName          \n\
	|                               # Attribute          \n\
	\\[  \
		\\s* (<unicode1>+)  (?:  \
			\\s* ([*^$!~|]?=)  (?:  \
				\\s* (?:\
					([\"']?)(.*?)\\9 \
				)\
			)  \
		)?  \\s*  \
	\\](?!\\]) \n\
	|   :+ ( <unicode>+ )(?:\
	\\( (?:\
		(?:([\"'])([^\\12]*)\\12)|((?:\\([^)]+\\)|[^()]*)+)\
	) \\)\
	)?\
	)"
*/
	"^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+)|\\[\\s*(<unicode1>+)(?:\\s*([*^$!~|]?=)(?:\\s*(?:([\"']?)(.*?)\\9)))?\\s*\\](?!\\])|(:+)(<unicode>+)(?:\\((?:(?:([\"'])([^\\13]*)\\13)|((?:\\([^)]+\\)|[^()]*)+))\\))?)"
	.replace(/<combinator>/, '[' + escapeRegExp(">+~`!@$%^&={}\\;</") + ']')
	.replace(/<unicode>/g, '(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
	.replace(/<unicode1>/g, '(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
);

function parser(
	rawMatch,

	separator,
	combinator,
	combinatorChildren,

	tagName,
	id,
	className,

	attributeKey,
	attributeOperator,
	attributeQuote,
	attributeValue,

	pseudoMarker,
	pseudoClass,
	pseudoQuote,
	pseudoClassQuotedValue,
	pseudoClassValue
){
	if (separator || separatorIndex === -1){
		parsed.expressions[++separatorIndex] = [];
		combinatorIndex = -1;
		if (separator) return '';
	}

	if (combinator || combinatorChildren || combinatorIndex === -1){
		combinator = combinator || ' ';
		var currentSeparator = parsed.expressions[separatorIndex];
		if (reversed && currentSeparator[combinatorIndex])
			currentSeparator[combinatorIndex].reverseCombinator = reverseCombinator(combinator);
		currentSeparator[++combinatorIndex] = {combinator: combinator, tag: '*'};
	}

	var currentParsed = parsed.expressions[separatorIndex][combinatorIndex];

	if (tagName){
		currentParsed.tag = tagName.replace(reUnescape, '');

	} else if (id){
		currentParsed.id = id.replace(reUnescape, '');

	} else if (className){
		className = className.replace(reUnescape, '');

		if (!currentParsed.classList) currentParsed.classList = [];
		if (!currentParsed.classes) currentParsed.classes = [];
		currentParsed.classList.push(className);
		currentParsed.classes.push({
			value: className,
			regexp: new RegExp('(^|\\s)' + escapeRegExp(className) + '(\\s|$)')
		});

	} else if (pseudoClass){
		pseudoClassValue = pseudoClassValue || pseudoClassQuotedValue;
		pseudoClassValue = pseudoClassValue ? pseudoClassValue.replace(reUnescape, '') : null;

		if (!currentParsed.pseudos) currentParsed.pseudos = [];
		currentParsed.pseudos.push({
			key: pseudoClass.replace(reUnescape, ''),
			value: pseudoClassValue,
			type: pseudoMarker.length == 1 ? 'class' : 'element'
		});

	} else if (attributeKey){
		attributeKey = attributeKey.replace(reUnescape, '');
		attributeValue = (attributeValue || '').replace(reUnescape, '');

		var test, regexp;

		switch (attributeOperator){
			case '^=' : regexp = new RegExp(       '^'+ escapeRegExp(attributeValue)            ); break;
			case '$=' : regexp = new RegExp(            escapeRegExp(attributeValue) +'$'       ); break;
			case '~=' : regexp = new RegExp( '(^|\\s)'+ escapeRegExp(attributeValue) +'(\\s|$)' ); break;
			case '|=' : regexp = new RegExp(       '^'+ escapeRegExp(attributeValue) +'(-|$)'   ); break;
			case  '=' : test = function(value){
				return attributeValue == value;
			}; break;
			case '*=' : test = function(value){
				return value && value.indexOf(attributeValue) > -1;
			}; break;
			case '!=' : test = function(value){
				return attributeValue != value;
			}; break;
			default   : test = function(value){
				return !!value;
			};
		}

		if (attributeValue == '' && (/^[*$^]=$/).test(attributeOperator)) test = function(){
			return false;
		};

		if (!test) test = function(value){
			return value && regexp.test(value);
		};

		if (!currentParsed.attributes) currentParsed.attributes = [];
		currentParsed.attributes.push({
			key: attributeKey,
			operator: attributeOperator,
			value: attributeValue,
			test: test
		});

	}

	return '';
};

exports.parse = parse;
exports.escapeRegExp = escapeRegExp;

});
define('shipyard/dom/Window', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('../class'),
	Node = require('./Node');


var Window = module.exports = new Class({

	Extends: Node,

	toString: function() {
		return '<window>';
	},

	get: function(name) {
		return this.node[name];
	}

});

});
define('shipyard/dom/Document', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('../class'),
	Node = require('./Node');

var Document = module.exports = new Class({

	Extends: Node,

	createElement: function(tag) {
		return Document.wrap(this.node.createElement(tag));
	},

	toString: function() {
		return '<document>';
	}

});

});
define('shipyard/dom/Element', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('../class'),
	Accessor = require('../utils/Accessor'),
	object = require('../utils/object'),
	typeOf = require('../utils/type').typeOf,
	Node = require('./Node'),
	Slick = require('./Slick'),
	Parser = Slick.Parser,
	Finder = Slick.Finder;


var classRegExps = {};
var classRegExpOf = function(string){
	return classRegExps[string] || 
		(classRegExps[string] = new RegExp('(^|\\s)' + Parser.escapeRegExp(string) + '(?:\\s|$)'));
};


var Element = new Class({
	
	Extends: Node,

	Matches: '*',

	initialize: function Element(node, options) {
		this.parent(node);
		this.set(options);
	},

	toString: function() {
		return '<' + this.get('tag') + '>';
	},


	//standard methods
	
	appendChild: function(child){
		this.node.appendChild(child);
		return this;
	},

	setAttribute: function(name, value){
		this.node.setAttribute(name, value);
		return this;
	},

	getAttribute: function(name){
		return this.node.getAttribute(name);
	},

	removeAttribute: function(name){
		this.node.removeAttribute(name);
		return this;
	},

	/*contains: function(node){
		return ((node = select(node))) ? Slick.contains(this.node, node.valueOf()) : false;
	},*/

	match: function(expression){
		return Slick.match(this.node, expression);
	},

	
	// className methods
	
	hasClass: function(className){
		return classRegExpOf(className).test(this.node.className);
	},

	addClass: function(className){
		var node = this.node;
		if (!this.hasClass(className)) 
			node.className = (node.className + ' ' + className);
		return this;
	},

	removeClass: function(className){
		var node = this.node;
		node.className = (node.className.replace(classRegExpOf(className), '$1'));
		return this;
	},

	dispose: function dispose() {
		return (this.node.parentNode) ? 
			this.parentNode.removeChild(this.node) : 
			this;
	},

	empty: function(shouldDestroy) {
		var children = this.node.childNodes;
		for (var i = 0, length = children.length; i < length; i++) {
			this.node.removeChild(children[i]);
		}
		return this;
	},

	serialize: function serialize() {
		var values = {},
			undefined;
		this.search("input, select, textarea").forEach(function forEach(el) {
			var type = el.get('type'),
				name = el.get('name');
			if(!name
				|| el.get('disabled')
				|| type=="submit" 
				|| type=="reset" 
				|| type=="file") return;
			var n = (el.get('tag') == 'select') ?
				el.search('option:selected').map(function(o){ return o.get('value'); }) :
				((type == 'radio' || type == 'checkbox') && !el.get('checked')) ?
					null :
					el.get('value');
			if (typeOf(n) == 'array' && n.length < 2) n = n[0];
			if(!values[name])
				values[name] = n;
			else if(n != undefined) {
				values[name] = Array(values[name]);
				values[name].push(n);
			}
		});
		return values;
	
	}


});

// Inserters

var inserters = {

	before: function(context, element){
		var parent = element.parentNode;
		if (parent) parent.insertBefore(context, element);
	},

	after: function(context, element){
		var parent = element.parentNode;
		if (parent) parent.insertBefore(context, element.nextSibling);
	},

	bottom: function(context, element){
		element.appendChild(context);
	},

	top: function(context, element){
		element.insertBefore(context, element.firstChild);
	}

};

Element.implement({

	inject: function(element, where){
		inserters[where || 'bottom'](this.node, element);
		return this;
	},

	eject: function(){
		var parent = this.node.parentNode;
		if (parent) parent.removeChild(this.node);
		return this;
	},

/*	adopt: function(){
		Array.forEach(arguments, function(element){
			if ((element = select(element))) this.node.appendChild(element.valueOf());
		}, this);
		return this;
	},*/

	appendText: function(text, where){
		inserters[where || 'bottom'](document.createTextNode(text), this.node);
		return this;
	},

	grab: function(element, where){
		inserters[where || 'bottom'](element, this.node);
		return this;
	},

	replace: function(element){
		element.parentNode.replaceChild(this.node, element);
		return this;
	},

	wrap: function(element, where){
		return this.replace(element).grab(element, where);
	}

});

/* Tree Walking */

var methods = {
	find: {
		getNext: '~',
		getPrevious: '!~',
		getFirst: '^',
		getLast: '!^',
		getParent: '!'
	},
	search: {
		getAllNext: '~',
		getAllPrevious: '!~',
		getSiblings: '~~',
		getChildren: '>',
		getParents: '!'
	}
};

object.forEach(methods, function(getters, method){
	Element.implement(object.map(getters, function(combinator){
		return function(expression){
			return this[method](combinator + (expression || '*'));
		};
	}));
});



// Getter / Setter

Accessor.call(Element, 'Getter');
Accessor.call(Element, 'Setter');

var properties = {
	'html': 'innerHTML',
	'class': 'className',
	'for': 'htmlFor'/*,
	'text': (function(){
		var temp = document.createElement('div');
		return (temp.innerText == null) ? 'textContent' : 'innerText';
	})()*/
};

[
	'checked', 'defaultChecked', 'type', 'value', 'accessKey', 'cellPadding', 
	'cellSpacing', 'colSpan', 'frameBorder', 'maxLength', 'readOnly', 
	'rowSpan', 'tabIndex', 'useMap',
	// Attributes
	'id', 'attributes', 'childNodes', 'className', 'clientHeight', 
	'clientLeft', 'clientTop', 'clientWidth', 'dir', 'firstChild',
	'lang', 'lastChild', 'name', 'nextSibling', 'nodeName', 'nodeType', 
	'nodeValue', 'offsetHeight', 'offsetLeft', 'offsetParent', 'offsetTop', 
	'offsetWidth', 'ownerDocument', 'parentNode', 'prefix', 'previousSibling', 
	'innerHTML', 'title'
].forEach(function(property){
	properties[property] = property;
});


object.forEach(properties, function(real, key){
	Element.defineSetter(key, function(value){
		return this.node[real] = value;
	}).defineGetter(key, function(){
		return this.node[real];
	});
});

var booleans = ['compact', 'nowrap', 'ismap', 'declare', 'noshade', 'checked',
	'disabled', 'multiple', 'readonly', 'selected', 'noresize', 'defer'];

booleans.forEach(function(bool){
	Element.defineSetter(bool, function(value){
		return this.node[bool] = !!value;
	}).defineGetter(bool, function(){
		return !!this.node[bool];
	});
});

Element.defineGetters({

	'class': function(){
		var node = this.node;
		return ('className' in node) ? node.className : node.getAttribute('class');
	},

	'for': function(){
		var node = this.node;
		return ('htmlFor' in node) ? node.htmlFor : node.getAttribute('for');
	},

	'href': function(){
		var node = this.node;
		return ('href' in node) ? node.getAttribute('href', 2) : node.getAttribute('href');
	},

	'style': function(){
		var node = this.node;
		return (node.style) ? node.style.cssText : node.getAttribute('style');
	}

}).defineSetters({

	'class': function(value){
		var node = this.node;
		return ('className' in node) ? node.className = value : node.setAttribute('class', value);
	},

	'for': function(value){
		var node = this.node;
		return ('htmlFor' in node) ? node.htmlFor = value : node.setAttribute('for', value);
	},

	'style': function(value){
		var node = this.node;
		return (node.style) ? node.style.cssText = value : node.setAttribute('style', value);
	}

});

/* get, set */

Element.implement({

	set: function(name, value){
		if (typeof name != 'string') for (var k in name) this.set(k, name[k]); else {
			var setter = Element.lookupSetter(name);
			if (setter) setter.call(this, value);
			else if (value == null) this.node.removeAttribute(name);
			else this.node.setAttribute(name, value);
		}
		return this;
	},

	get: function(name){
		if (arguments.length > 1) return Array.prototype.map.call(arguments, function(v, i){
			return this.get(v);
		}, this);
		var getter = Element.lookupGetter(name);
		if (getter) return getter.call(this);
		return this.node.getAttribute(name);
	}

});

Element.defineGetter('tag', function(){
	return this.node.tagName.toLowerCase();
});


module.exports = Element;

});
define('shipyard/utils/Accessor', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var typeOf = require('./type').typeOf,
	object = require('./object');

module.exports = function(singular, plural){

	var accessor = {}, matchers = [];

	if (!plural) plural = singular + 's';

	var define = 'define', lookup = 'lookup', match = 'match', each = 'each';

	var defineSingular = this[define + singular] = function(key, value){
		if (typeOf(key) == 'regexp') matchers.push({'regexp': key, 'value': value, 'type': typeOf(value)});
		else accessor[key] = value;
		return this;
	};

	var definePlural = this[define + plural] = function(object){
		for (var key in object) accessor[key] = object[key];
		return this;
	};

	var lookupSingular = this[lookup + singular] = function(key){
		if (accessor.hasOwnProperty(key)) return accessor[key];
		for (var l = matchers.length; l--; l){
			var matcher = matchers[l], matched = key.match(matcher.regexp);
			if (matched && (matched = matched.slice(1))){
				if (matcher.type == 'function') return function(){
					return matcher.value.apply(this, [].slice.call(arguments).concat(matched));
				}; else return matcher.value;
			}
		}
		return null;
	};

	var lookupPlural = this[lookup + plural] = function(){
		var results = {};
		for (var i = 0; i < arguments.length; i++){
			var argument = arguments[i];
			results[argument] = lookupSingular(argument);
		}
		return results;
	};

	var eachSingular = this[each + singular] = function(fn, bind){
		object.forEach(accessor, fn, bind);
	};

};


});
define('shipyard/dom/Elements', [], function(require, exports, module){
// Parts copied or inspired by MooTools (http://mootools.net) 
// - MIT Licence
var Class = require('../class'),
	Element = require('./Element'),
	object = require('../utils/object'),
	overloadSetter = require('../utils/function').overloadSetter;

function Elements() {
	this.uids = {};
	if (arguments.length) this.push.apply(this, arguments);
}

Elements.prototype = object.create(Array.prototype);

Elements.implement = overloadSetter(function implement(key, value) {
	this.prototype[key] = value;
});

Elements.implement({
	
	length: 0,

	push: function push() {
		for (var i = 0, len = arguments.length; i < len; i++) {
			this[this.length++] = arguments[i];
		}
		return this.length;
	}

});

// all Element methods should be available on Elements as well
var implementOnElements = function(key, fn) {
	if (!Elements.prototype[key]) Elements.prototype[key] = function(){
		var elements = new Elements, results = [];
		for (var i = 0; i < this.length; i++){
			var node = this[i], result = node[key].apply(node, arguments);
			if (elements && !(result instanceof Element)) elements = false;
			results[i] = result;
		}

		if (elements){
			elements.push.apply(elements, results);
			return elements;
		}
		
		return results;
	};
};


// suck in all current methods
var dontEnum = {};
['toString', 'initialize', 'appendChild', 'match'].forEach(function(val) { dontEnum[val] = 1; });
for (var k in Element.prototype) {
	var prop = Element.prototype[k];
	if (!dontEnum[k] && !Elements.prototype[k] && (typeof prop == 'function')) {
		implementOnElements(k, Element.prototype[k]);
	}

}

// grab all future methods
var elementImplement = Element.implement;

Element.implement = function(key, fn){
	if (typeof key != 'string') for (var k in key) this.implement(k, key[k]); else {
		implementOnElements(key, fn);
		elementImplement.call(Element, key, fn);
	}
};


module.exports = Elements;

});
define('shipyard/utils/string', [], function(require, exports, module){
var shipyard = 'shipyard',
	counter = (new Date()).getTime();

exports.uniqueID = function() {
	return shipyard + '-' + counter++;
};

var subRE = /\\?\{([^{}]+)\}/g;
exports.substitute = function substitute(str, obj, regexp) {
	return String(str).replace(regexp || subRE, function(match, name) {
		if (match.charAt(0) == '\\') return match.slice(1);
		if (obj[name] != null) {
			if (typeof obj[name] == 'function') return obj[name]();
			else return obj[name];
		} else {
			return '';
		}
	})
	for (var key in obj) {
		ret = str.replace()
	}
};

});
document.addEventListener("DOMContentLoaded", function() {require("editor");}, false);