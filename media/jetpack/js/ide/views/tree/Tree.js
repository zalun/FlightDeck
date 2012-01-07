var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    Events = require('shipyard/class/Events'),
    string = require('shipyard/utils/string'),
    dom = require('shipyard/dom'),
    Draggable = require('shipyard/drag/Draggable'),
    Anim = require('shipyard/anim/Animation');

var uid = '$tree:' + string.uniqueID();

var bind = function() {
    var bound = {},
        key;
    for (var i = 0, len = arguments.length; i < len; i++) {
        key = arguments[i];
        bound[key] = this[key].bind(this);
    }
    return bound;
};

module.exports = new Class({

    Implements: [Options, Events],

    options: {
        /*onChange: function() {},*/
        indicatorOffset: 0,
        cloneOffset: {x: 16, y: 16},
        cloneOpacity: 0.8,
        checkDrag: function() { return true; },
        checkDrop: function() { return true; }
    },

    initialize: function(element, options) {
        this.setOptions(options);
        element = this.element = dom.$(element);
        return element.retrieve(uid) || this.setup();
    },

    setup: function() {
        this.element.store(uid, this);
        this.indicator = new dom.Element('div', {
            'class': 'treeIndicator'
        });
        
        var tree = this;
        this.handler = function(e) {
            tree.mousedown(this, e);
        };
        
        this.bound = bind.call(this, 'hideIndicator', 'onDrag', 'onDrop');
        this.attach();
    },

    attach: function() {
        var tree = this;
        this.downHandler = this.element.delegate('li', 'mousedown', function(e) {
            tree.mousedown(this, e);
        });
        this.upHandler = dom.document.body.addListener('mouseup', function(e) {
            tree.mouseup(this, e);
        });
        return this;
    },

    detach: function() {
        this.downHandler.detach();
        this.upHandler.detach();
        return this;
    },

    mousedown: function(element, event) {
        this.padding = (this.element.getElement('li ul li') || this.element.getElement('li')).getLeft() - this.element.getLeft() + this.options.indicatorOffset;

        if(!this.options.checkDrag.call(this, element)) {
            return;
        }
        if (this.collapse && element.match(this.collapse.options.selector)) {
            return;
        }

        this.current = element;
        this._clone = element.clone().setStyles({
            left: event.page.x + this.options.cloneOffset.x,
            top: event.page.y + this.options.cloneOffset.y,
            opacity: this.options.cloneOpacity
        }).addClass('drag').inject(dom.document.body);

        var dragger = new Draggable(this._clone, {
            droppables: this.element.getElements('li span'),
            onLeave: this.bound.hideIndicator,
            onDrag: this.bound.onDrag,
            onDrop: this.bound.onDrop,
            preventDefault: true,
            container: this.options.container ? (dom.$(this.options.container) || this.element) : null
        });
        dragger.start(event);
    },

    mouseup: function() {
        if (this._clone) {
            this._clone = this._clone.destroy();
        }
    },

    onDrag: function(el, event) {
        clearTimeout(this.timer);
        if (this.previous) {
            var anim = new Anim(this.previous, {
                duration: 150
            });
            anim.start('opacity', 1);
        }
        this.previous = null;

        if (!event || !event.target) {
            return;
        }

        var target = dom.$(event.target);

        var droppable = (target.get('tag') === 'li') ? target : target.getParent('li');
        if (!droppable || this.element === droppable || !this.element.contains(droppable)) {
            return;
        }

        if (this.collapse) {
            this.expandCollapsed(droppable);
        }

        var coords = droppable.getCoordinates(),
            marginTop =  parseInt(droppable.getStyle('marginTop'), 10),
            center = coords.top + marginTop + (coords.height / 2),
            isSubnode = (event.page.x > coords.left + this.padding),
            position = {
                x: coords.left + (isSubnode ? this.padding : 0),
                y: coords.top
            };

        var drop;
        if (this.current === droppable || this.current === droppable.getParent('li')) {
            this.drop = {};
        } else if (event.page.y >= center) {
            position.y += coords.height;
            drop = {
                target: droppable,
                where: 'after',
                isSubnode: isSubnode
            };
            if (!this.options.checkDrop.call(this, droppable, drop)) {
                return;
            }
            this.setDropTarget(drop);
        } else if (event.page.y < center) {
            position.x = coords.left;
            drop = {
                target: droppable,
                where: 'before'
            };
            if (!this.options.checkDrop.call(this, droppable, drop)) {
                return;
            }
            this.setDropTarget(drop);
        }

        if (this.drop.target) {
            this.showIndicator(position);
        } else {
            this.hideIndicator();
        }
    },

    onDrop: function(el) {
        el.destroy();
        this.hideIndicator();

        var drop = this.drop,
            current = this.current;
        if (!drop || !drop.target) {
            return;
        }

        var previous = current.getParent('li');
        if (drop.isSubnode) {
            current.inject(drop.target.getElement('ul') || new dom.Element('ul').inject(drop.target), 'bottom');
        } else {
            current.inject(drop.target, drop.where || 'after');
        }

        if (this.collapse) {
            if (previous) {
                this.collapse.updateElement(previous);
            }
            this.collapse.updateElement(drop.target);
        }
        
        this.fireEvent('change');
    },

    setDropTarget: function(drop) {
        this.drop = drop;
    },

    showIndicator: function(position) {
        this.indicator.setStyles({
            left: position.x + this.options.indicatorOffset,
            top: position.y
        }).inject(dom.document.body);
    },

    hideIndicator: function() {
        this.indicator.dispose();
    },

    expandCollapsed: function(element) {
        var child = element.getElement('ul');
        if (!child || !this.collapse.isCollapsed(child)) {
            return;
        }

        var anim = new Anim(element, {
            duration: 150,
            property: 'opacity'
        });
        anim.start(1, 0.5);
        this.previous = element;

        var tree = this;
        this.timer = setTimeout(function() {
            anim.start(1);
            tree.collapse.expand(element);
        }, 300);
    },

    serialize: function(fn, base) {
        if (!base) {
            base = this.element;
        }
        if (!fn) {
            fn = function(el) {
                return el.get('id');
            };
        }
        
        var result = {};
        base.getChildren('li').forEach(function(el) {
            var child = el.getElement('ul');
            result[fn(el)] = child ? this.serialize(fn, child) : true;
        }, this);
        return result;
    }

});
