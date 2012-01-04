var Request = require('shipyard/http/Request'),
	dom = require('shipyard/dom');

var admin_settings;
var PRESSED = 'pressed';

function setMsg(msg) {
	var elem = dom.$('package_msg');
	elem.set('html', msg);
	setTimeout(function() {
		elem.set('html', '');
	}, 2000);
}

function updatePackage(elem, field, callback) {
	var id = elem.getParent('.package').getElement('.package_id').get('value'),
		parent = elem.getParent(),
		enabled = parent.hasClass(PRESSED),
		data = {
			package_id: id
		};
	data[field] = !enabled;
	new Request({
		url: admin_settings.update_package_url,
		method: 'post',
		data: data,
		onSuccess: function() {
			setMsg('updated');
			if (enabled) {
				parent.removeClass(PRESSED);
			} else {
				parent.addClass(PRESSED);
			}
			if (callback) {
				callback();
			}
		},
		onFailure: function() {
			if (this.xhr.status === 404) {
				dom.$('package_item').set('html', '');
			}
			setMsg(this.xhr.status + " " + this.xhr.statusText);
		}
	}).send();
}

exports.init = function(settings) {
	admin_settings = settings;

	var item = dom.$('package_item');
	item.delegate('.UI_Package_Featured a', 'click', function(e) {
		e.stop();
		updatePackage(this, 'featured');
	});
	item.delegate('.UI_Package_Example a', 'click', function(e) {
		e.stop();
		updatePackage(this, 'example');
	});

	dom.$('btn_find_package').addListener('click', function(e) {
		new Request({
			url: admin_settings.get_package_url,
			method: 'get',
			data: {
				package_id: dom.$('txt_package_id').get('value')
			},
			onSuccess: function(text) {
				item.set('html', text);
			},
			onFailure: function() {
				setMsg(this.xhr.status + ' ' + this.xhr.statusText);
			}
		}).send();
	});
};
