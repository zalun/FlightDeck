/*
 * Extending Flightdeck with Editor functionality
 */

FlightDeck = Class.refactor(FlightDeck,{
	initialize: function(options) {
		this.setOptions(options);
		this.sidebar = new Sidebar();
		this.previous(options);

		this.edited = false;
		window.addEvent('beforeunload', function(e) {
			if (fd.edited && !fd.saving) {
				e.stop();
				e.returnValue = "You've got unsaved changes.";
			} else {
			}
		});
		this.enableMenuButtons();
		this.addEvent('change', this.onChanged);
		this.addEvent('save', this.onSaved);
	},
	onChanged: function() {
		this.edited = true;
	},
	onSaved: function() {
		this.edited = false;
	},
	/*
	 * Method: getItem
	 */
	getItem: function() {
		return this.item;
	},
	/*
	 * Method: enableMenuButtons
	 * Switch on menu buttons, check if possible
	 */
	enableMenuButtons: function() {
		$$('.' + this.options.menu_el + ' li.disabled').each(function(menuItem){
			var switch_on = true;
			if (switch_on) {
				menuItem.removeClass('disabled');
			}
		}, this);
	}

});
