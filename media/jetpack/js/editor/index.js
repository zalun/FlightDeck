require.paths.unshift('/media/lib/shipyard/lib');

//exports.Package = require('./models/Package');

// requiring these now so they are included in the bundle
// eventually, this file would connect Models and Views with some
// controllers
exports.Ace = require('./views/FDEditor.Ace');
exports.Sidebar = require('./views/Sidebar');
exports.Tabs = require('./views/Tabs');
