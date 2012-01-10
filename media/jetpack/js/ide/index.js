// requiring these now so they are included in the bundle
var settings = require('ide/settings');
var PackageController = require('./controllers/PackageController');
var Package = require('./models/Package');
var TabsController = require('./controllers/TabsController');
var Ace = require('./views/FDEditor.Ace');
var Sidebar = require('./views/Sidebar');
var object = require('shipyard/utils/object');
var log = require('shipyard/utils/log');
var flightdeck = require('flightdeck');

exports.init = function() {
	log.debug('ide/index loaded');

	var ide = {};
	var tabs = ide.tabs = new TabsController();
	var sidebar = ide.sidebar = new Sidebar({
		editable: !settings.readonly
	});
	var ace = ide.ace = new Ace('editor-wrapper');

	var data = object.merge({}, settings, {
		description: settings.package_description,
		author: settings.package_author,
		version_name: settings.package_version_name
	});
	var p = ide.item = new Package(data);
	ide.controller = new PackageController(p, settings, ace, tabs, sidebar);

	// TODO: remove this once no files outside 'editor' app need the editor
	window.editor = ide;
	return ide;
};
