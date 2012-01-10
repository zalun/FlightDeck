var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    object = require('shipyard/utils/object');


var Tab = new Class({
    
    Implements: [Events, Options],
    
    options: {
        tag: 'span',
        title: 'Untitled',
        inject: 'bottom',
        closeable: true
    },
    
    initialize: function(container, options){
        this.setOptions(options);
        
        this.container = dom.$(container);
        
        this.element = new dom.Element(this.options.tag, {
            'class': 'tab small',
            'styles': {
                'position': 'relative',
                'display': 'inline-block',
                'cursor': 'default'
            }
        }).store('tab:instance', this).inject(this.container, this.options.inject);
        this.label = new dom.Element('span', {
            'text': this.options.title,
            'class': 'label'
        }).inject(this.element);
        
        if (this.options.closeable) {
            this.close = new dom.Element('span', {
                'class': 'tab-close',
                'html': 'x',
                'styles': {
                    'display': 'inline-block',
                    'height': 15,
                    'line-height': 14,
                    'margin-left': 4,
                    'cursor': 'pointer'
                }
            }).inject(this.element);
        }
        
        return this;
    },
    
    destroy: function() {
        this.emit('destroy');
        this.removeListeners();

        this.element = this.element.destroy();
        this.close = this.close.destroy();
    },

    setLabel: function(text) {
        this.label.set('text', text);
    },
    
    toElement: function() {
        return this.element;
    }
    
});

var TabBar = new Class({
    
    Implements: [Events, Options],
    
    options: {
        tag: 'div',
        inject: 'top'
    },
    
    initialize: function(element, options){
        this.setOptions(options);
        
        var bar = this,
            tabEvents = {};
        
        this.element = new dom.Element('div', {
            'class': 'tab-bar',
            'styles': {
                'position': 'relative'
            }
        }).inject(dom.$(element), this.options.inject);
        
        this.tabs = new dom.Element(this.options.tag, {
            'class': 'tab-container',
            'styles': {
                'overflow': 'hidden',
                'white-space': 'nowrap'
            },
            'events': tabEvents
        }).inject(this.element);

        //events: Down,Up,Enter,Leave
        //targets: tab-close, everything else
        object.forEach({
            'tabDown': ['mousedown'],
            'tabUp': ['mouseup'],
            'tabEnter': ['mouseenter'],
            'tabLeave': ['mouseleave'],
            'closeDown': ['mousedown', 'tab-close'],
            'closeUp': ['mouseup', 'tab-close'],
            'closeEnter': ['mouseenter', 'tab-close'],
            'closeLeave': ['mouseleave', 'tab-close']
        }, function(val, eventName){
            var evt = val[0],
                cls = val[1] || 'tab';
            //unless otherwise specified (like tab-close), events will bubble
            //to the .tab element, and therefore still fire. This lets us
            //add a .label element, and still fire events for the whole .tab.
            this.tabs.delegate('.'+cls, evt, function(e, target) {
                if((cls === 'tab' && !this.hasClass('tab-close')) ||
                    this.hasClass(cls)) {
                    bar.emit(eventName, this, e);
                }
            });
            
            
        }, this);
        

        
    },
    
    setSelected: function(tab) {
        this.element.getElements('.tab.selected').removeClass('selected');
        dom.$(tab).addClass('selected');
    },
    
    toElement: function() {
        return this.tabs;
    }
    
});

exports.Tab = Tab;
exports.TabBar = TabBar;
