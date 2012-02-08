/**
 * Roar - Notifications
 *
 * Inspired by Growl
 *
 * @version		1.0.1
 *
 * @license		MIT-style license
 * @author		Harald Kirschner <mail [at] digitarald.de>
 * @copyright	Author
 */
var Class = require('shipyard/class/Class'),
	Options = require('shipyard/class/Options'),
	Events = require('shipyard/class/Events'),
	dom = require('shipyard/dom'),
	Anim = require('shipyard/anim/Animation'),
	Back = require('shipyard/anim/transitions/Back'),
	Circ = require('shipyard/anim/transitions/Circ'),
	object = require('shipyard/utils/object'),
	string = require('shipyard/utils/string'),
	typeOf = require('shipyard/utils/type').typeOf;

var STORAGE_ANIM = '__roar:anim';
var STORAGE_OFFSET = '__roar:offset';

module.exports = new Class({

	Implements: [Options, Events],

	options: {
		duration: 3000,
		position: 'upperLeft',
		container: null,
		bodyFx: null,
		itemFx: null,
		margin: {x: 10, y: 10},
		offset: 10,
		className: 'roar',
		onShow: function(){},
		onHide: function(){},
		onRender: function(){}
	},

	initialize: function(options) {
		this.setOptions(options);
		this.items = [];
		this.container = dom.$(this.options.container) || dom.document;
	},

	alert: function(title, message, options) {
		var items = [new dom.Element('h3', { 'html': title || '' })];
		if (message) {
			items.push(new dom.Element('p', {'html': message}));
		}
		return this.inject(items, options);
	},

	inject: function(elements, options) {
		if (!this.body) {
			this.render();
		}
		options = options || {};

		var offset = [-this.options.offset, 0];
		var last = this.items[this.items.length - 1];
		if (last) {
			offset[0] = last.retrieve(STORAGE_OFFSET);
			offset[1] = offset[0] + last.get('offsetHeight') + this.options.offset;
		}
		var to = {'opacity': 1};
		to[this.align.y] = offset;

		var item = new dom.Element('div', {
			'class': options.className || this.options.className,
			'styles': {
				'opacity': 0
			},
			id: string.uniqueID()
		});
		elements.unshift(new dom.Element('div', {
			'class': 'roar-bg',
			'style': {
				'opacity': 0.7
			}
		}));

		elements.forEach(function(el) {
			item.appendChild(el);
		});

		item.setStyle(this.align.x, 0).store(STORAGE_OFFSET, offset[1]);
		
		var anim = new Anim(item, object.merge({}, {
			unit: 'px',
			link: 'cancel',
			transition: Back.easeOut
		}, this.options.itemFx));
		item.store(STORAGE_ANIM, anim);

		var that = this;
		var remove = function() {
			setTimeout(function() {
				that.remove(item);
			}, 10);
		};
		
		this.items.push(item);
		item.addListener('click', remove);

		if (options.duration || this.options.duration) {
			var over = false;
			var trigger = setTimeout(function() {
				trigger = null;
				if (!over) {
					remove();
				}
			}, options.duration || this.options.duration);
			item.addListeners({
				mouseover: function() {
					over = true;
				},
				mouseout: function() {
					over = false;
					if (!trigger) {
						remove();
					}
				}
			});
		}
		item.inject(this.body);
		anim.start(to);
		return this.emit('show', item, this.items.length);
	},

	remove: function(item) {
		var index = this.items.indexOf(item);
		if (index === -1) {
			return this;
		}
		this.items.splice(index, 1);
		item.removeListeners();
		var to = {opacity: 0};
		to[this.align.y] = parseInt(item.getStyle(this.align.y), 10) - item.get('offsetHeight') - this.options.offset;

		var anim = item.retrieve(STORAGE_ANIM);
		anim.once('complete', function() {
			item.destroy();
		});
		anim.start(to);
		return this.emit('hide', item, this.items.length);
	},

	empty: function() {
		while (this.items.length) {
			this.remove(this.items[0]);
		}
		return this;
	},

	render: function() {
		this.position = this.options.position;
		if (typeOf(this.position) === 'string') {
			var position = {x: 'center', y: 'center'};
			this.align = {x: 'left', y: 'top'};
			if ((/left|west/i).test(this.position)) {
				position.x = 'left';
			} else if ((/right|east/i).test(this.position)) {
				this.align.x = position.x = 'right';
			}
			if ((/upper|top|north/i).test(this.position)) {
				position.y = 'top';
			} else if ((/bottom|lower|south/i).test(this.position)) {
				this.align.y = position.y = 'bottom';
			}
			this.position = position;
		}
		this.body = new dom.Element('div', {'class': 'roar-body'}).inject(dom.document.body);
		this.moveTo = this.body.setStyles.bind(this.body);
		this.reposition();
		if (this.options.bodyFx) {
			var anim = new Anim(this.body, object.merge({}, {
				unit: 'px',
				chain: 'cancel',
				transition: Circ.easeOut
			}, this.options.bodyFx));
			this.moveTo = anim.start.bind(anim);
		}
		var repos = this.reposition.bind(this);
		dom.window.addListeners({
			scroll: repos,
			resize: repos
		});
		this.emit('render', this.body);
	},

	reposition: function() {
		var max = dom.document.getCoordinates(),
			scroll = dom.document.getScroll(),
			margin = this.options.margin;
		max.left += scroll.x;
		max.right += scroll.x;
		max.top += scroll.y;
		max.bottom += scroll.y;
		var rel = (typeOf(this.container) === 'element') ? this.container.getCoordinates() : max;
		this.moveTo({
			left: (this.position.x === 'right') ?
				(Math.min(rel.right, max.right) - margin.x) :
				(Math.max(rel.left, max.left) + margin.x),
			top: (this.position.y === 'bottom') ?
				(Math.min(rel.bottom, max.bottom) - margin.y) :
				(Math.max(rel.top, max.top) + margin.y)
		});
	}

});

