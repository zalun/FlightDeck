var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    Anim = require('shipyard/anim/Animation'),
    Sine = require('shipyard/anim/transitions/Sine'),
    string = require('shipyard/utils/string');

var uid = '$collapse:' + string.uniqueID();

var ANIM_OPTIONS = {
    duration: Anim.SHORT,
    property: 'opacity',
    transition: Sine
};

module.exports = new Class({

    Implements: Options,

    options: {
        animate: true,
        fadeOpacity: 0.5,
        className: 'collapse',
        selector: 'a.expand',
        listSelector: 'li',
        childSelector: 'ul'
    },

    initialize: function(element, options) {
        this.setOptions(options);
        element = this.element = dom.$(element);

        return element.retrieve(uid) || this.setup();
    },

    setup: function() {
        this.element.store(uid, this);

        var self = this;
        this.handler = function(e) {
            self.toggle(this, e);
        };

        this.mouseover = function() {
            if (self.hasChildren(this)) {
                var el = this.getElement(self.options.selector);
                var anim = new Anim(el, ANIM_OPTIONS);
                anim.start(self.options.fadeOpacity, 1);
            }
        };
        
        this.mouseout = function() {
            if (self.hasChildren(this)) {
                var el = this.getElement(self.options.selector);
                var anim = new Anim(el, ANIM_OPTIONS);
                anim.start(1, self.options.fadeOpacity);
            }
        };
        
        this.prepare().attach();
    },

    attach: function() {
        var element = this.element;
        this.clickHandler = element.delegate(this.options.selector, 'click', this.handler);
        if (this.options.animate) {
            this.overHandler = element.delegate(this.options.listSelector, 'mouseover', this.mouseover);
            this.outHandler = element.delegate(this.options.listSelector, 'mouseout', this.mouseout);
        }
        return this;
    },

    detach: function() {
        this.clickHandler.detach();
        if (this.overHandler) {
            this.overHandler.detach();
        }
        if (this.outHandler) {
            this.outHandler.detach();
        }
        return this;
    },

    prepare: function() {
        this.prepares = true;
        this.element.getElements(this.options.listSelector).forEach(this.updateElement, this);
        this.prepares = false;
        return this;
    },

    updateElement: function(element) {
        var child = element.getElement(this.options.childSelector),
            icon = element.getElement(this.options.selector),
            anim = new Anim(icon, ANIM_OPTIONS);

        if (!this.hasChildren(element)) {
            if (!this.options.animate || this.prepares) {
                icon.setStyle('opacity', 0);
            } else {
                anim.start(0);
            }
            return;
        }

        if (this.options.animate) {
            anim.start(this.options.fadeOpacity);
        } else {
            icon.set('opacity', this.options.fadeOpacity);
        }

        if (this.isCollapsed(child)) {
            icon.removeClass('collapse');
        } else {
            icon.addClass('collapse');
        }
    },

    hasChildren: function(element) {
        var child = element.getElement(this.options.childSelector);
        return (child && child.getChildren().length);
    },

    isCollapsed: function(element) {
        return (element.getStyle('display') === 'none');
    },

    toggle: function(element, event) {
        if (event) {
            event.preventDefault();
        }
        
        if (!element.match(this.options.listSelector)) {
            element = element.getParent(this.options.listSelector);
        }

        if (!this.hasChildren(element)) {
            //must have clicked an invisible toggle
            return this;
        }
        
        if (this.isCollapsed(element.getElement(this.options.childSelector))) {
            this.expand(element);
        } else {
            this.collapse(element);
        }

        return this;
    },

    expand: function(element) {
        element.getElement(this.options.childSelector).setStyle('display', 'block');
        element.getElement(this.options.selector).addClass(this.options.className);
        return this;
    },

    collapse: function(element) {
        element.getElement(this.options.childSelector).setStyle('display', 'none');
        element.getElement(this.options.selector).removeClass(this.options.className);
        return this;
    }

});
