var dom = require('shipyard/dom'),
	Request = require('shipyard/http/Request');

var LOADING_CLASS = 'loading',
	LOADING_SMALL = 'small',
	fd;

var browser_test_item = function(el) {
	el.addListener('click', function(e){
		e.stop();
		var hashtag = this.get('data-hashtag');
		var testThisXpi = function() {
			var loader = this.getParent('li.UI_Item');
			fd.tests[hashtag] = {
				'spinner': loader.addClass('loading')
			};
			var data = { hashtag: hashtag };
			new Request({
				url: el.get('href'),
				data: data,
				onSuccess: function() {
					fd.testXPI(data);
				},
				onComplete: function() {
					loader.removeClass('loading');
				}
			}).send();
		}.bind(this);
		if (fd.alertIfNoAddOn()) {
			if (el.getParent('li').hasClass('pressed')) {
				fd.uninstallXPI(el.get('data-jetpackid'));
			} else {
				testThisXpi();
			}
		} else {
			fd.whenAddonInstalled(function() {
				fd.message.alert(
					'Add-on Builder Helper',
					'Now that you have installed the Add-on Builder ' +
					'Helper, loading the add-on into your browser for ' +
					'testing...'
				);
				testThisXpi();
			}.bind(this));
		}
	});
};

var browser_disable_item = function(el) {
	el.addListener('click', function(e){
		if (e) {
			e.stop();
		}
		if (el.get('href') && !el.hasClass('inactive')) {
			var spinner = this.getParent('li.UI_Item');
			spinner.addClass(LOADING_CLASS).addClass(LOADING_SMALL);
			new Request({
				url: el.get('href'),
				onSuccess: function(response) {
					response = JSON.parse(response);
					el.getParent('li.UI_Item').destroy();
					fd.message.alert(response.message_title, response.message);
					fd.emit('deactivate_' + response.package_type);
					if (dom.$('activate')) {
						dom.$('activate').addListener('click', function(e2){
							e2.stop();
							new Request({
								url: el.get('href'),
								onSuccess: function() {
									var loc = dom.window.get('location');
									loc.reload();
								}
							}).send();
						});
					}
				},
				onComplete: function() {
					spinner.removeClass(LOADING_CLASS);
				}
			}).send();
		}
	});
};

var browser_activate_item = function(el) {
	el.addListener('click', function(e){
		if (e) {
			e.stop();
		}
		if (el.get('href') && !el.hasClass('inactive')) {
			var ui_item = this.getParent('li.UI_Item');
			ui_item.addClass(LOADING_CLASS).addClass(LOADING_SMALL);
			new Request({
				url: el.get('href'),
				onSuccess: function(response) {
					response = JSON.parse(response);
					ui_item.destroy();
					fd.message.alert(response.message_title, response.message);
					fd.emit('activate_' + response.package_type);
				},
				onFailure: function() {
					ui_item.removeClass(LOADING_CLASS);
				}
			}).send();
		}
	});
};

var browser_delete_item = function(el) {
	el.addListener('click', function(e){
		if (e) {
			e.stop();
		}
		var itemEl = this.getParent('.UI_Item');
		fd.showQuestion({
			title: "Deleting Package with all revisions",
			message: "Are you sure you want to delete this Package ?" +
				"</p><p>There is no undo.",
			buttons: [{
					type: 'reset',
					text: 'Cancel',
					'class': 'close'
				},{
					type: 'submit',
					text: 'DELETE',
					id: 'delete_package',
					irreversible: true,
					callback: function(e2) {
						itemEl.addClass(LOADING_CLASS);
						new Request({
							url: el.get('href'),
							onSuccess: function(response) {
								response = JSON.parse(response);
								itemEl.destroy();
								fd.message.alert(
									response.message_title, response.message
								);
							},
							onFailure: function() {
								itemEl.removeClass(LOADING_CLASS);
							}
						}).send();
					},
					'default': true
				}]
		});
	});
};

var change_no = function(a, b, inc) {
	if (dom.$(a) && dom.$(b)) {
		dom.$(a).set('text', parseInt(dom.$(a).get('text'), 10) + inc);
		dom.$(b).set('text', parseInt(dom.$(b).get('text'), 10) - inc);
	}
};

var on_activate_library = function() {
	change_no('public_libs_no', 'private_libs_no', 1);
};

var on_deactivate_library = function() {
	change_no('public_libs_no', 'private_libs_no', -1);
};

var on_activate_addon = function() {
	change_no('public_addons_no', 'private_addons_no', 1);
};

var on_deactivate_addon = function() {
	change_no('public_addons_no', 'private_addons_no', -1);
};


exports.init = function(fd_) {
	fd = fd_;

	dom.$$('.XPI_test a').forEach(browser_test_item);
	dom.$$('.UI_Disable a').forEach(browser_disable_item);
	dom.$$('.UI_Activate a').forEach(browser_activate_item);
	dom.$$('.UI_Delete a').forEach(browser_delete_item);

	fd.addListener('activate_l', on_activate_library);
	fd.addListener('deactivate_l', on_deactivate_library);
	fd.addListener('activate_a', on_activate_addon);
	fd.addListener('deactivate_a', on_deactivate_addon);
};

