//TODO: perhaps the shipyard scripts/require should push shipyards path onto
//it automatically?
require.paths.unshift('/media/lib/shipyard/lib');

// requiring these now so they are included in the bundle
// eventually, this file would connect Models and Views with some
// controllers
exports.Ace = require('./views/FDEditor.Ace');
exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');

//var Package = exports.Package = require('./models/Package');
//var p = new Package(settings); //settings is globally set
