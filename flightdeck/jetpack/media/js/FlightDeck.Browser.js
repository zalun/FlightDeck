/*
 * Extending Flightdeck with Browser functionality 
 * loading XPI from saved objects
 */ 

FlightDeck = Class.refactor(FlightDeck,{
	options: {
		try_in_browser_class: 'XPI_test',
		delete_class: 'UI_Delete'
	},
	initialize: function(options) {
		this.setOptions(options);
		this.previous(options);
		$$('.{try_in_browser_class} a'.substitute(this.options)).each(function(el) {
			el.addEvent('click', function(e){
				e.stop();
				if (fd.alertIfNoAddOn()) {
					if (el.getParent('li').hasClass('pressed')) {
						fd.uninstallXPI(el.get('rel'));
					} else {
						new Request.JSON({
							url: el.get('href'),
							onSuccess: fd.testXPI.bind(fd)
						}).send();
					}
				}
			});
		});
		$$('.{delete_class} a'.substitute(this.options)).each(function(el) {
			el.addEvent('click', function(e){
				e.stop();
				new Request.JSON({
					url: el.get('href'),
					onSuccess: function(response) {
						el.getParent('li.UI_Item').destroy();
						fd.message.alert(response.message_title, response.message);
						if ($('undelete')) {
							$('undelete').addEvent('click', function(e2){
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
	}
});
