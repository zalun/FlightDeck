var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    Events = require('shipyard/class/Events'),
    dom = require('shipyard/dom'),
    Anim = require('shipyard/anim/Animation'),
    Sine = require('shipyard/anim/transitions/Sine'),
    Draggable = require('shipyard/drag/Draggable'),
    string = require('shipyard/utils/string');

var START = '<div class="UI_Modal_Wrapper"><div class="UI_Modal">',
    END = '</div></div>';

module.exports = new Class({

    Implements: [Events, Options],

    options: {
        content: '',
        draggable: true,
        dragHandle: null,
        zIndex: 9000,
		closeHandle: '.closeModal'
    },

    initialize: function Modal(options) {
        var modal = this;
		this.setOptions(options);


        this.element = new dom.Element('div', {
            'class': 'fd-modal',
            'id': string.uniqueID(),
            'html': START + this.getOption('content') + END,
            'styles': {
                'position': 'absolute',
                'z-index': this.getOption('zIndex'),
                'visibility': 'hidden'
            }
        }).inject(dom.document.body);

        if (this.getOption('draggable')) {
            var dragger = new Draggable(this.element, {
                handle: this.getOption('dragHandle') || this.element,
				onDrag: function(e) {
					modal.emit('drag', e);
				}
            });
        }

		// closeable
		var closeBtn = this.element.getElement(this.getOption('closeHandle'));
		if (closeBtn) {
			closeBtn.addListener('click', function(e) {
				e.stop();
				modal.destroy();
			});
			var keydownHandle = dom.window.addListener('keydown', function(e) {
				if (e.key === 'esc') {
					modal.destroy();
				}
			});
			this.addListener('destroy', function() {
				keydownHandle.detach();
			});
		}

        this.anim = new Anim(this.element, {
            duration: Anim.SHORT,
            transition: Sine.easeInOut
        });
    },

    show: function() {
        var modal = this;

        this._position();
        this.element.setStyles({
			'visibility': 'visible',
			'opacity': 0
		});
        this.anim.start('opacity', 0, 1);
        this.anim.once('complete', function() {
            modal.emit('show');
        });
		return this;
    },

    hide: function() {
        var modal = this;
        this.anim.start('opacity', 1, 0);
        this.anim.once('complete', function() {
            modal.element.setStyle('visibility', 'hidden');
			modal.emit('hide');
        });
		return this;
    },

    destroy: function() {
		this.emit('destroy');
        this.element.destroy();
        delete this.element;
        this.isDestroyed = true;
    },

    _position: function _position() {
        var el = this.element,
            elSize = el.getSize(),
            winSize = dom.window.getSize(),
			scroll = dom.window.getScroll();

        el.setPosition({
            x: (winSize.x - elSize.x) / 2 + scroll.x,
            y: (winSize.y - elSize.y) / 2 + scroll.y
        });
    },

    toElement: function() {
        return this.element;
    }

});
