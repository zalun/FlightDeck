(function() {

var isMac = (Browser.Platform.name == 'mac'),
	controlRE = /control|ctrl/g,
	macControlToMeta = function(text) {
		return isMac ? text.replace(controlRE, 'meta') : text;
	};

FlightDeck.Keyboard = new Class({
	
	Extends: Keyboard,
	
	addEvent: function(type, fn, internal) {
		return this.parent(macControlToMeta(type), fn, internal);
	},
	
	removeEvent: function(type, fn) {
		return this.parent(macControlToMeta(type), fn);
	},
	
	addShortcut: function(name, shortcut) {
		if (shortcut.keys) {
			shortcut.keys = macControlToMeta(shortcut.keys);
		}
		return this.parent(name, shortcut);
	}
	
});

})();