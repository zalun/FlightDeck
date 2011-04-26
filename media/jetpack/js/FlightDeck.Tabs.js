FlightDeck.Tab = new Class({
	
	Implements: [Events, Options],
	
	options: {
		tag: 'li',
		title: 'Untitled',
		inject: 'bottom',
		closeable: true
	},
	
	initialize: function(container, options){
		this.setOptions(options);
		
		this.container = $(container);
		
		this.element = new Element(this.options.tag, {
			'class': 'tab',
			'text': this.options.title,
			'styles': {
				'display': 'inline',
				'cursor': 'pointer'
			}
		}).store('tab:instance', this).inject(this.container, this.options.inject)
		
		if (this.options.closeable) {
			this.close = new Element('span', {
				'class': 'tab-close',
				'html': '&#10799;',
				'styles': {
					'margin-left': 4,
					'text-align': 'right'
				}
			}).inject(this.element);
		}
		
		return this;
	},
	
	destroy: function() {
		this.fireEvent('destroy');
		this.element = this.element.destroy();
		this.close = this.close.destroy();
		this.file.tab = null;
		this.file = this.container = null;
	},

    setLabel: function(text) {
        this.element.set('text', text);
        if(this.close) {
            this.element.grab(this.close);
        }
    },
	
	toElement: function() {
		return this.element;
	}
	
});

FlightDeck.TabBar = new Class({
	
	Implements: [Events, Options],
	
	options: {
		tag: 'ul',
		inject: 'top',
		scrollStart: 0,
		arrows: {
			width: 40,
			images: ['http://t3.gstatic.com/images?q=tbn:ANd9GcS0Hc6RIVSXTki0OJWsVV5d2asDioT6F9QxBB8_NjiuSSZSTJ-M', 'http://t2.gstatic.com/images?q=tbn:ANd9GcTtPqzrVe3cRKo5oryDaPhoZr2xXLV7RyV1t6QOKjD6gOW0k-Xb']
		},
		fx: {
			duration: 250,
			transition: 'circ:out',
			link: 'cancel',
			wheelStops: false,
		}
	},
	
	initialize: function(element, options){
		this.setOptions(options);
		
		var bar = this,
			arrows = this.options.arrows,
			tabEvents = {};
		
		this.element = new Element('div', {
			'class': 'tab-bar',
			'styles': {
				'position': 'relative',
				'padding-left': (arrows) ? arrows.width : 0
			}
		}).inject($(element), this.options.inject);
		
		Object.each({
			'tabDown': ['mousedown', 'tab'],
			'tabUp': ['mouseup', 'tab'],
			'tabEnter': ['mouseenter', 'tab'],
			'tabLeave': ['mouseleave', 'tab'],
			'closeDown': ['mousedown', 'tab-close'],
			'closeUp': ['mouseup', 'tab-close'],
			'closeEnter': ['mouseenter', 'tab-close'],
			'closeLeave': ['mouseleave', 'tab-close'],
		}, function(val, key){
			tabEvents[val[0] + ':relay(.' + val[1] + ')'] = function(e){
				if(e.target.hasClass(val[1])) bar.fireEvent(key, [this, e]);
			};
		});
		
		this.tabs = new Element(this.options.tag, {
			'class': 'tab-container',
			'styles': {
				'overflow': 'hidden'
			},
			'events': tabEvents
		}).addEvent('mousewheel', function(e){
			bar.scrollTabs(['left', 'right'][e.wheel < 0 ? 0 : 1])
		}).inject(this.element);
		
		this.scroll = new Fx.Scroll(this.tabs, this.options.fx)
		.start(this.options.scrollStart, 0)
		.addEvent('complete', function(){
			this.passed = [];
		});
		
		if(arrows) {
			this.buildArrows();
		}
		
	},
	
	setSelected: function(tab) {
		$(this).getElements('.tab.selected').removeClass('selected');
		$(tab).addClass('selected');
	},
	
	buildArrows: function() {
		var arrows = this.options.arrows;
		var arrow = '<li style="float: left; width: 50%; height: 100%; opacity: 0.5; cursor: pointer; background: url(img) no-repeat center center;"></li>';
		this.arrows = new Element('ul', {
			'class': 'tab-arrows',
			'html': arrow.replace('img', arrows.images[0]) + arrow.replace('img', arrows.images[1]),
			'styles': {
				'position': 'absolute',
				'top': 0,
				'left': 0,
				'height': '100%',
				'width': arrows.width
			},
			'events': {
				'mouseenter:relay(li)': function(){
					this.set('tween', { duration: 160 }).tween('opacity', 1)
				},
				'mouseleave:relay(li)': function(){
					this.tween('opacity', 0.5)
				},
				'mousedown:relay(li)': function(e){
					this.scrollTabs(['left', 'right'][this.arrows.getChildren().indexOf(e.target)]);
				}.bind(this)
			}
		}).inject(this.element, 'top');
	},
	
	reduceTabs: function(direction){
		var tabs = this.tabs.getChildren(),
			width = this.tabs.getSize().x,
			bit = (direction == 'left') ? 1 : 0;
			
		return (bit ? tabs.reverse() : tabs).filter(function(tab, i, a){
			var coord = tab.getCoordinates(this.tabs)[direction];
			if((bit ? coord < 0 : coord > width) && !this.scroll.passed.contains(tab) || tabs.length - 1 == i) return true;
		}, this)[0];
	},
	
	scrollTabs: function(index){
		var tabs = this.tabs.getChildren(),
			tab = (typeof index == 'number') ? tabs[index.limit(0, tabs.length - 1)] : this.reduceTabs(index);	
		
		if(tab){
			this.scroll.passed.include(tab);
			this.scroll.toElementEdge(tab, this.options.axis);
		}
		
		return this;
	},
	
	toElement: function() {
		return this.tabs;
	}
	
	
});
