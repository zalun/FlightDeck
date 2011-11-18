var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    Anim = require('shipyard/anim/Animation'),
    Sine = require('shipyard/anim/transitions/Sine');

module.exports = new Class({

    Extends: Options,

    options: {
        pattern: /.*/,
        message: 'Illegal characters found.'
    },

    initialize: function Validator(element, options) {
        this.target = dom.$(element);
        this.setOptions(options);
        this.attach();
    },

    attach: function() {
        var validator = this;
        this.detach();
        this._handle = this.target.addListener('blur', function() {
            if (!validator.validate()) {
                validator.show();
            } else {
                validator.hide();
            }
        });
    },

    detach: function() {
        if (this._handle) {
            this._handle.detach();
        }
    },

    validate: function validate() {
        var value = this.target.get('value');
        return this.options.pattern.test(value);
    },

    show: function show() {
        var validator = this;

        if (!this.element) {
            this.element = new dom.Element('div', {
                'class': 'validation-advice',
                'text': this.getOption('message'),
                'styles': {
                    'height': 0,
                    'display': 'block',
                    'overflow': 'hidden',
                    'opacity': 0
                }
            });
            
            //measure the height
            this.element.setStyles({
                'visibility': 'hidden',
                'position': 'absolute'
            });
            this.element.inject(validator.target, 'after');
            this.height = this.element.getHeight();
            this.element.dispose().setStyles({
                visibility: 'visible',
                position: 'static'
            });

            this.anim = new Anim(this.element, {
                transition: Sine
            });
        }

        this.anim.once('start', function() {
            validator.element.inject(validator.target, 'after');
        });
        this.anim.start({
            height: [0, this.height],
            opacity: [0, 1]
        });
    },

    hide: function hide() {
        var validator = this;
        if (this.element) {
            this.anim.once('complete', function() {
                validator.element.dispose();
            });
            this.anim.start({
                height: [this.height, 0],
                opacity: [1, 0]
            });
        }
    },

    toElement: function() {
        return this.element;
    }

});
