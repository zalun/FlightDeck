var Class = require('shipyard/class/Class'),
	Options = require('shipyard/class/Options'),
	Events = require('shipyard/class/Events'),
	Draggable = require('shipyard/drag/Draggable'),
	dom = require('shipyard/dom');

function limit(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

module.exports = new Class({

	Implements: [Events, Options],

	options: {
		initialStep: 0,
		snap: false,
		offset: 0,
		range: false,
		wheel: false,
		steps: 100,
		mode: 'horizontal'
	},

	initialize: function(element, knob, options) {
		this.element = dom.$(element);
		this.knob = knob = dom.$(knob);
		this.setOptions(options);

		this.previousChange = this.previousEnd = this.step = -1;
		var limit = {},
			modifiers = {
				x: false,
				y: false
			};

		switch (this.getOption('mode')) {
			case 'vertical':
				this.axis = 'y';
				this.property = 'top';
				this.offset = 'offsetHeight';
				break;
			case 'horizontal':
				this.axis = 'x';
				this.property = 'left';
				this.offset = 'offsetWidth';
				break;
		}

		this.setSliderDimensions();
		this.setRange(this.getOption('range'));

		if (knob.getStyle('position') === 'static') {
			knob.setStyle('position', 'relative');
		}

		var offset = this.getOption('offset');
		knob.setStyle(this.property, -offset);
		modifiers[this.axis] = this.property;
		limit[this.axis] = [-offset, this.full - offset];


		var dragOptions = {
			snap: 0,
			limit: limit,
			modifiers: modifiers,
			onDrag: this.draggedKnob.bind(this),
			onStart: this.draggedKnob.bind(this),
			onBeforeStart: (function() {
				this.isDragging = true;
			}).bind(this),
			onCancel: function() {
				this.isDragging = false;
			}.bind(this),
			onComplete: function() {
				this.isDragging = false;
				this.draggedKnob();
				this.end();
			}.bind(this)
		};
		if (this.getOption('snap')) {
			this.setSnap(dragOptions);
		}

		this.drag = new Draggable(knob, dragOptions);
		this.attach();

		var initialStep = this.getOption('initialStep');
		if (initialStep != null) {
			this.set(initialStep);
		}
	},

	attach: function() {
		this._clickHandle = this.element.addListener('mousedown', this.clickedElement.bind(this));
		this.drag.attach();
		return this;
	},

	detach: function() {
		if (this._clickHandle) {
			this._clickHandle.detach();
		}
		this.drag.detach();
		return this;
	},

	setSnap: function(options) {
		if (!options) {
			options = this.drag.options;
		}
		options.grid = Math.ceil(this.stepWidth);
		options.limit[this.axis][1] = this.full;
		return this;
	},

	setKnobPosition: function(pos) {
		if (this.getOption('snap')) {
			pos = this.toPosition(this.step);
		}
		this.knob.setStyle(this.property, pos);
		return this;
	},

	setSliderDimensions: function() {
		var knobOffset = this.knob.getNode()[this.offset];
		this.half = knobOffset / 2;
		this.full = this.element.getNode()[this.offset] - knobOffset + this.getOption('offset')*2;
		return this;
	},

	set: function(step) {
		if (!((this.range > 0) ^ (step < this.min))) {
			step = this.min;
		}
		if (!((this.range > 0) ^ (step > this.max))) {
			step = this.max;
		}
		this.step = Math.round(step);
		this.checkStep();
		var pos = this.toPosition(this.step);
		this.setKnobPosition(pos);
		this.emit('tick', this.toPosition(this.step));
		this.end();
		return this;
	},

	setRange: function(range, pos) {
		this.min = range[0] || 0;
		this.max = range[1] || this.getOption('steps');
		this.range = this.max - this.min;
		this.steps = this.getOption('steps') || this.full;
		this.stepSize = Math.abs(this.range) / this.steps;
		this.stepWidth = this.stepSize * this.full / Math.abs(this.range);
		if (range) {
			this.set(Math.max(this.max, Math.floor(pos || this.step)));
		}
		return this;
	},

	clickedElement: function(event) {
		if (this.isDragging || dom.Element.wrap(event.target) === this.knob) {
			return;
		}

		var dir = this.range < 0 ? -1 : 1,
			position = event.page[this.axis] - this.element.getPosition()[this.axis] - this.half,
			offset = this.getOption('offset');


		position = limit(position, -offset, this.full - offset);

		this.step = Math.round(this.min + dir * this.toStep(position));

		this.checkStep();
		this.setKnobPosition(position);
		this.emit('tick', position);
		this.end();
	},

	scrolledElement: function(event) {
		var mode = (this.options.mode === 'horizontal') ? (event.wheel < 0) : (event.wheel > 0);
		this.set(this.step + (mode ? -1 : 1) * this.stepSize);
		event.stop();
	},

	draggedKnob: function() {
		var dir = this.range < 0 ? -1 : 1,
			position = this.drag.value.now[this.axis],
			offset = this.getOption('offset');

		position = limit(position, -offset, this.full - offset);

		this.step = Math.round(this.min + dir * this.toStep(position));
		this.checkStep();
	},

	checkStep: function() {
		var step = this.step;
		if (this.previousChange !== step) {
			this.previousChange = step;
			this.fireEvent('change', step);
		}
		return this;
	},

	end: function() {
		var step = this.step;
		if (this.previousEnd !== step) {
			this.previousEnd = step;
			this.emit('complete', step + '');
		}
		return this;
	},

	toStep: function(position) {
		var step = (position + this.options.offset) * this.stepSize / this.full * this.steps;
		return this.options.steps ? Math.round(step -= step % this.stepSize) : step;
	},

	toPosition: function(step) {
		return (this.full * Math.abs(this.min - step)) / (this.steps * this.stepSize) - this.options.offset;
	}


});
