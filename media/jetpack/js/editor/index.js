var settings = require('editor/settings');

// requiring these now so they are included in the bundle
//TODO: eventually, this file would connect Models and Views with some
// controllers
exports.Ace = require('./views/FDEditor.Ace');
exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');

var Package = require('./models/Package');
exports.item = new Package(settings)
