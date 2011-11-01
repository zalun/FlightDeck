// requiring these now so they are included in the bundle
var settings = require('ide/settings');
var PackageController = require('./controllers/PackageController');
var Package = require('./models/Package');
var TabsController = require('./controllers/TabsController');
var Ace = require('./views/FDEditor.Ace');
var Sidebar = require('./views/Sidebar');
var object = require('shipyard/utils/object');

// TODO: remove this once no files outside 'editor' app need the editor
window.editor = exports;


if (window.console) console.log('editor/index');

var tabs = exports.tabs = new TabsController();
var sidebar = exports.sidebar = new Sidebar({ 
    editable: !settings.readonly
});
var ace = exports.ace = new Ace('editor-wrapper');

var data = object.merge({}, settings, {
    description: settings.package_description,
    author: settings.package_author,
    version_name: settings.package_version_name
});
var p = exports.item = new Package(data);
exports.controller = new PackageController(p, settings, ace, tabs, sidebar);
