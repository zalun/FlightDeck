/*
 * Extending Flightdeck with Browser functionality 
 * loading XPI from saved objects
 */ 

FlightDeck = Class.refactor(FlightDeck,{
	options: {
		try_in_browser_class: 'XPI_test',
		disable_class: 'UI_Disable',
		activate_class: 'UI_Activate'
	},
	initialize: function(options) {
		this.setOptions(options);
		this.previous(options);
		$$('.{try_in_browser_class} a'.substitute(this.options)).each(function(el) {
			el.addEvent('click', function(e){
				e.stop();
				var testThisXpi = function() {
					new Request.JSON({
						url: el.get('href'),
                        useSpinner: true,
                        spinnerTarget: this.getParent('li'),
						onSuccess: fd.testXPI.bind(fd)
					}).send();
				}.bind(this);
				if (fd.alertIfNoAddOn()) {
					if (el.getParent('li').hasClass('pressed')) {
						fd.uninstallXPI(el.get('rel'));
					} else {
						testThisXpi();
					}
				} else {
					fd.whenAddonInstalled(function() {
						fd.message.alert(
							'Add-on Builder Helper', 
							'Now that you have installed the Add-ons Builder Helper, loading the add-on into your browser for testing...'
						);
						testThisXpi();
					}.bind(this));
				}
			});
		});
		$$('.{disable_class} a'.substitute(this.options)).each(function(el) {
			el.addEvent('click', function(e){
				e.stop();
				new Request.JSON({
					url: el.get('href'),
					onSuccess: function(response) {
						el.getParent('li.UI_Item').destroy();
						fd.message.alert(response.message_title, response.message);
						if ($('activate')) {
							$('activate').addEvent('click', function(e2){
								e2.stop();
								var self = this;
								new Request.JSON({
									url: self.get('href'),
									onSuccess: function(response) {
										window.location.reload();
									}
								}).send();
							});
						}
					}
				}).send();
			});
		});
		$$('.{activate_class} a'.substitute(this.options)).each(function(el) {
			el.addEvent('click', function(e){
				e.stop();
				new Request.JSON({
					url: el.get('href'),
					onSuccess: function(response) {
						el.getParent('li.UI_Item').destroy();
						fd.message.alert(response.message_title, response.message);
					}
				}).send();
			});
		});
	}
});
