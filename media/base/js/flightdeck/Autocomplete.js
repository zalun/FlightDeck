var Class = require('shipyard/class/Class'),
	Options = require('shipyard/class/Options'),
	Events = require('shipyard/class/Events'),
	Request = require('shipyard/http/Request'),
	dom = require('shipyard/dom'),
	string = require('shipyard/utils/string');

var CONTROL_KEYS = {
	esc: 1,
	enter: 1,
	up: 1,
	down: 1,
	shift: 1
};

module.exports = new Class({

	Implements: [Events, Options],

	options: {
		valueField: null,
		valueFilter: null,
		filter: null,
		minChars: 2,
		limit: 20,
		hoverClass: 'fd-hover',
		loadingClass: 'fd-loading'
	},

	_cache: {},

	initialize: function(input, url, options) {
		this.input = dom.$(input);
		this.url = url;
		this.setOptions(options);

		this.element = new dom.Element('div', {
			'class': 'fd-autocomplete',
			'id': string.uniqueID()
		});
		dom.document.body.appendChild(this.element);

		this.valueField = dom.$(this.getOption('valueField')) || this.input;

		this._addInputEvents();
		this._addListEvents();
		this._createEmptyWarning();
		this.positionNextTo();
	},

	_addInputEvents: function() {
		var ac = this;
		this.input.addListener('keyup', function(e) {
			if (e.key in CONTROL_KEYS) {
				return;
			}
			ac._setupList();
		});
		this.input.addListener('blur', function(e) {
			ac.hide();
		});
		this.input.addListener('keydown', function(e) {
			var nextItem;
			if (ac._isShowing) {
				switch (e.key) {
					case 'enter':
						//select currently focusedItem
						e.stop();
						ac._selectFocusedItem();
						break;
					case 'esc':
						//hide list
						e.stop();
						ac.hide();
						break;
					case 'up':
						//focus previous item
						e.stop();
						if (ac._focusedItem) {
							nextItem = ac._focusedItem.getPrevious('li');
						}
						if (!nextItem) {
							nextItem = ac.element.getElement('ul').getLast('li');
						}
						ac._focusItem(nextItem);
						break;
					case 'down':
						//focus next item
						e.stop();
						if (ac._focusedItem) {
							nextItem = ac._focusedItem.getNext('li');
						}
						if (!nextItem) {
							nextItem = ac.element.getElement('ul').getFirst('li');
						}
						ac._focusItem(nextItem);
						break;
				}
			}
		});
	},

	_addListEvents: function() {
		var ac = this;
		this.element.delegate('li', 'mouseover', function(e, li) {
			ac._focusItem(li);
		});
		this.element.delegate('li', 'mousedown', function(e, li) {
			ac._selectFocusedItem();
		});
	},

	_createEmptyWarning: function() {
		var warning = this._warning = new dom.Element('div', {
			'class': 'autocomplete roar tip warning',
			'html': '<div class="roar-bg"></div><h3>No libraries found.</h3><p>Check your spelling?</p>'
		}).inject(this.input, 'after');

		var pos = this.input.getPosition(),
			size = this.input.getSize();

		warning.setStyles({
			top: 50,
			left: size.x + 55,
			position: 'absolute'
		});

		warning.setStyle('visibility', 'hidden');
	},

	_focusItem: function(item) {
		if (item === this._focusedItem) {
			return;
		}
		var hoverClass = this.getOption('hoverClass');
		if (this._focusedItem) {
			this._focusedItem.removeClass(hoverClass);
		}
		item.addClass(hoverClass);
		this._focusedItem = item;
		this.emit('focusItem', item);
	},

	_selectFocusedItem: function() {
		if (this._focusedItem) {
			var index = this._focusedItem.get('data-index');
			var data = this._cache[this._text];
			var valueFilter = this.getOption('valueFilter');
			this.input.set('value', data[index].full_name);
			this.valueField.set('value', valueFilter(data[index]));

			this.emit('select');
			this.hide();
		}
	},

	_setupList: function _setupList() {
		this._text = this.input.get('value').trim();
		if (this._cache[this._text]) {
			this._renderList();
		} else {
			this._fetchList();
		}
	},

	_fetchList: function _fetchList() {
		var ac = this,
			text = this._text,
			loadingClass = this.getOption('loadingClass');
		this.emit('request', text);
		this._warning.setStyle('visibility', 'hidden');
		this.input.addClass(loadingClass);
		return new Request({
			url: this.url,
			method: 'get',
			data: {
				q: text,
				limit: this.getOption('limit')
			},
			onSuccess: function(response) {
				response = JSON.parse(response);
				ac._cache[text] = response;
				ac._renderList();
			},
			onComplete: function() {
				ac.input.removeClass(loadingClass);
			}
		}).send();
	},

	_renderList: function() {
        if (!this.element) {
            // this.element has already been destroy, likely from
            // picking a value while a Request was fetching results
            return;
        }
		var data = this._cache[this._text];
		this._focusedItem = null;
		
		if (data && data.length) {
			var ul = new dom.Element('ul');
			data.forEach(function(item, i) {
				var li = new dom.Element('li');
				li.set('data-index', i);
				li.set('html', item.html);
				ul.appendChild(li);
			});
			this.element.empty().appendChild(ul);
			this._warning.setStyle('visibility', 'hidden');
			this.emit('render');
			this.show();
		} else {
			this.emit('empty');
			this._warning.setStyle('visibility', 'visible');
			this.hide();
		}
	},

	show: function() {
		this.element.setStyle('visibility', 'visible');
		this._isShowing = true;
		this.emit('show');
	},

	hide: function hide() {
		this.element.setStyle('visibility', 'hidden');
		this._isShowing = false;
		this.emit('hide');
	},

	destroy: function() {
		this.hide();
		this.element.destroy();
		this._warning.destroy();
		delete this.element;
	},

	positionNextTo: function(target) {
		target = dom.$(target || this.input);
		var pos = target.getPosition();
		this.element.setStyles({
			top: pos.y + target.getHeight(),
			left: pos.x,
			width: target.getWidth()
		});
	},

	toElement: function() {
		return this.element;
	}

});
