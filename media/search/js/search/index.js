var dom = require('shipyard/dom'),
	history = dom.window.get('history'),
	URI = require('shipyard/utils/URI'),
	
	SearchResult = require('./models/SearchResult');

var flightdeck = require('flightdeck');

exports.init = function init() {
	//cool browsers only
	if (!(history && history.pushState)) {
		return;
	}
	
	dom.$('app-body').delegate('a', 'click', function(e, a) {
		if (a.getNode().pathname === dom.window.get('location').pathname) {
			e.preventDefault();
			SearchResult.page(a.get('href'));
		}
	});
	
	dom.$('app-body').delegate('input[type="checkbox"]', 'click', function(e, input) {
		var loc = new URI(dom.window.get('location'));
		var filter = input.get('name');
		if (input.get('checked')) {
			loc.setData(filter,1);
		} else {
			loc.setData(filter,0);
		}
		input.set('checked', !input.get('checked')); //for caching
		SearchResult.page(loc);
	});

	dom.$('Search').addListener('submit', function(e) {
		e.preventDefault();
		var loc = new URI(String(dom.window.get('location'))),
			q = this.getElement('input[name=q]');
		if (loc.getData('q') !== q.get('value')) {
			loc.setData('q', q.get('value'));
			SearchResult.page(loc);
		}
	});

	dom.window.addListener('popstate', function(e) {
		SearchResult.fetch(String(dom.window.get('location')));
	});
	
	dom.$('app-body').delegate('#SortSelect', 'change',function(e){
		var u = new URI(dom.window.get('location'));
		var oldValue = u.getData('sort');
		u.setData('sort',this.getSelected().get('value')[0]);
		SearchResult.page(String(u));
		// Since we cache these pages, we need to set the select
		// value back to the original value. Otherwise,
		// when this page is pulled from the cache the selected
		// option will not match the querystring
		Array.from(this.options).each(function(o,i){
			if(o.value === oldValue){
				o.selected = true;
				this.selectedIndex = i;
			}
		});
	});

	SearchResult.setupUI();
};
