var Class = require('shipyard/class/Class'),
	typeOf = require('shipyard/utils/type').typeOf,
	Validator = require('./Validator');

module.exports = new Class({

	Extends: Validator,

	validate: function validate() {
		var text = this.target.get('value').trim();
		if (text) {
			try {
				var json = JSON.parse(text);
				// number, string, array, etc are illegal.
				return typeOf(json) === 'object';
			} catch (jsonError) {
				return false;
			}
		}
		return true;
	}

});
