var settings = require('editor/settings');
var PackageController = require('./controllers/PackageController');

// requiring these now so they are included in the bundle
//TODO: eventually, this file would connect Models and Views with some
// controllers
var Ace = require('./views/FDEditor.Ace');
var editor = exports = module.exports = new Ace('editor-wrapper');

exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');

var Package = require('./models/Package');
fd.sidebar.options.editable = settings.editable;
fd.sidebar.buildTree();



var p = exports.item = new Package(settings);
exports.controller = new PackageController(p, settings);
