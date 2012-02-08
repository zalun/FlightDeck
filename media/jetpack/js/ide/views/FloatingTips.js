//authors:
//- Lorenzo Stanco
var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    Events = require('shipyard/class/Events'),
    dom = require('shipyard/dom'),
    Anim = require('shipyard/anim/Animation'),
    Sine = require('shipyard/anim/transitions/Sine'),
    _dim = require('shipyard/dom/element/dimensions');

var AVAILABLE_POSITIONS = ['top', 'right', 'bottom', 'left', 'inside'];

var PREFIX = 'ide:',
    STORE_TIP = PREFIX + 'tip',
    STORE_TIMEOUT = STORE_TIP + ':timeout',
    DATA_TITLE = 'data-floatingtitle';

module.exports = new Class({

    Implements: [Options, Events],

    options: {
        position: 'top',
        center: true,
        content: 'title',
        html: false,
        balloon: true,
        arrowSize: 6,
        arrowOffset: 6,
        distance: 3,
        motion: 6,
        motionOnShow: true,
        motionOnHide: true,
        showOn: 'mouseenter',
        hideOn: 'mouseleave',
        showDelay: 0,
        hideDelay: 0,
        className: 'floating-tip',
        offset: {
            x: 0,
            y: 0
        },
        fx: {
            'duration': 'short',
            'transition': Sine
        }
    },

    initialize: function FloatingTips(elements, options) {
        this.setOptions(options);
        if (!~AVAILABLE_POSITIONS.indexOf(this.options.position)) {
            this.setOption('position', 'top');
        }
        if (elements) {
            this.attach(elements);
        }
    },

    attach: function attach(elements) {
        var s = this;
        dom.$$(elements).forEach(function(e) {
            var evs = {};
            evs[s.options.showOn] = function() {
                s.show(e);
            };
            evs[s.options.hideOn] = function() {
                s.hide(e);
            };
            e.addListeners(evs);
        });
        return this;
    },

    show: function show(element) {
        var old = element.retrieve(STORE_TIP);
        if (old && old.getStyle('opacity') === 1) {
            clearTimeout(old.retrieve(STORE_TIMEOUT));
            return this;
        }
        var tip = this._create(element);
        if (tip == null) {
            return this;
        }
        element.store(STORE_TIP, tip);
        this._animate(tip, 'in');
        this.emit('show', tip, element);
        return this;
    },
    
    hide: function hide(element) {
        var tip = element.retrieve(STORE_TIP);
        if (!tip) {
            return this;
        }
        this._animate(tip, 'out');
        this.emit('hide', tip, element);
        return this;
    },
    
    _create: function _create(elem) {
        
        var o = this.options;
        var oc = o.content;
        var opos = o.position;
        
        if (oc === 'title') {
            oc = DATA_TITLE;
            if (!elem.get(DATA_TITLE)) {
                elem.set(DATA_TITLE, elem.get('title'));
            }
            elem.set('title', null);
        }
        
        var cnt = (typeof(oc) === 'string' ? elem.get(oc) : oc(elem));
        if (!cnt) {
            return null;
        }
        var cwr = new dom.Element('div', {
            'class': o.className,
            'styles': {
                margin: 0
            }
        });
        var tip = new dom.Element('div', {
            'class': o.className + '-wrapper',
            'styles': {
                margin: 0,
                padding: 0,
                'z-index': cwr.getStyle('z-index')
            }
        });

        tip.appendChild(cwr);

        if (o.html) {
            cwr.set('html', typeof(cnt) === 'string' ? cnt : cnt.get('html'));
        } else {
            cwr.set('text', cnt);
        }
        
        var body = dom.document.body;
        tip.setStyles({ 'position': 'absolute', 'opacity': 0 }).inject(body);
        if (o.balloon) {
            
            var trg = new dom.Element('div', {
                'class': o.className + '-triangle',
                'styles': {
                    'margin': 0,
                    'padding': 0
                }
            });
            var trgSt = {
                'border-color': cwr.getStyle('background-color'),
                'border-width': o.arrowSize,
                'border-style':'solid',
                'width': 0,
                'height': 0
            };
            
            switch (opos) {
                case 'inside':
                case 'top':
                    trgSt['border-bottom-width'] = 0;
                    break;
                case 'right':
                    trgSt['border-left-width'] = 0;
                    trgSt.float = 'left';
                    cwr.setStyle('margin-left', o.arrowSize);
                    break;
                case 'bottom':
                    trgSt['border-top-width'] = 0;
                    break;
                case 'left':
                    trgSt['border-right-width'] = 0;
                    cwr.setStyle('margin-right', o.arrowSize);
                    break;
            }
            
            switch (opos) {
                case 'inside':
                case 'top':
                case 'bottom':
                    trgSt['border-left-color'] = trgSt['border-right-color'] = 'transparent';
                    trgSt['margin-left'] = o.center ? tip.getSize().x / 2 - o.arrowSize : o.arrowOffset; break;
                case 'left':
                case 'right':
                    trgSt['border-top-color'] = trgSt['border-bottom-color'] = 'transparent';
                    trgSt['margin-top'] = o.center ?  tip.getSize().y / 2 - o.arrowSize : o.arrowOffset; break;
            }
            
            trg.setStyles(trgSt).inject(tip, (opos === 'top' || opos === 'inside') ? 'bottom' : 'top');
            
        }
        
        var tipSz = tip.getSize(), trgC = elem.getCoordinates(body);
        var pos = { x: trgC.left + o.offset.x, y: trgC.top + o.offset.y };
        
        if (opos === 'inside') {
            tip.setStyles({ 'width': tip.getStyle('width'), 'height': tip.getStyle('height') });
            elem.setStyle('position', 'relative').adopt(tip);
            pos = { x: o.offset.x, y: o.offset.y };
        } else {
            switch (opos) {
                case 'top':     pos.y -= tipSz.y + o.distance; break;
                case 'right':   pos.x += trgC.width + o.distance; break;
                case 'bottom':  pos.y += trgC.height + o.distance; break;
                case 'left':    pos.x -= tipSz.x + o.distance; break;
            }
        }
        
        if (o.center) {
            switch (opos) {
                case 'top': case 'bottom': pos.x += (trgC.width / 2 - tipSz.x / 2); break;
                case 'left': case 'right': pos.y += (trgC.height / 2 - tipSz.y / 2); break;
                case 'inside':
                    pos.x += (trgC.width / 2 - tipSz.x / 2);
                    pos.y += (trgC.height / 2 - tipSz.y / 2); break;
            }
        }
        
        var anim = new Anim(tip, o.fx);
        tip.store('anim', anim).store('position', pos);
        tip.setStyles({ 'top': pos.y, 'left': pos.x });
        
        return tip;
        
    },
    
    _animate: function _animate(tip, d) {
        clearTimeout(tip.retrieve(STORE_TIMEOUT));
        var delay = (d === 'in') ? this.options.showDelay : this.options.hideDelay;
        var o = this.options, din = (d === 'in');

        var t = setTimeout(function() {
            
            var m = { 'opacity': din ? 1 : 0 };
            
            if ((o.motionOnShow && din) || (o.motionOnHide && !din)) {
                var pos = tip.retrieve('position');
                if (!pos) {
                    return;
                }
                switch (o.position) {
                    case 'inside':
                    case 'top':     m.top  = din ? [pos.y - o.motion, pos.y] : pos.y - o.motion; break;
                    case 'right':   m.left = din ? [pos.x + o.motion, pos.x] : pos.x + o.motion; break;
                    case 'bottom':  m.top  = din ? [pos.y + o.motion, pos.y] : pos.y + o.motion; break;
                    case 'left':    m.left = din ? [pos.x - o.motion, pos.x] : pos.x - o.motion; break;
                }
            }
            
            var anim = tip.retrieve('anim');
            anim.start(m);
            if (!din) {
                anim.once('complete', function() {
                    tip.dispose();
                });
            }
            
        }, delay);
        
        tip.store(STORE_TIMEOUT, t);
        return this;
        
    }

});
