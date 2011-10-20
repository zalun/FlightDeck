// requiring these now so they are included in the bundle
var settings = require('editor/settings');
var PackageController = require('./controllers/PackageController');
var Package = require('./models/Package');
var TabsController = require('./controllers/TabsController');
var Ace = require('./views/FDEditor.Ace');
var Sidebar = require('./views/Sidebar');

// TODO: remove this once no files outside 'editor' app need the editor
window.editor = exports;


//TODO: eventually, this file would connect Models and Views with some
// controllers

console.log('editor/index');

exports.tabs = new TabsController();
exports.sidebar = new Sidebar({ editable: !settings.readonly });
exports.ace = new Ace('editor-wrapper');

var p = exports.package = new Package(settings);
exports.controller = new PackageController(p, settings, exports.ace, exports.tabs, exports.sidebar);
