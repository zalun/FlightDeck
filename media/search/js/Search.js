var SearchResult = new Class({
	
	initialize: function(url) {
		this.url = url
	},

	load: function() {
		SearchResult.$loading = this;
		this.request = new Request.HTML({
			url: this.url,
			filter: 'section',
			useSpinner: true,
			spinnerTarget: 'SearchResults',
			onSuccess: function(tree, elements, html) {
				if (SearchResult.$loading == this) SearchResult.$loading = null;
				this.content = tree;
				this.show();
			}.bind(this)
		}).send();

		return this;
	},

	show: function() {
		if (!this.content && !(this.request && this.request.isRunning())) {
			return this.load();
		}

		var results = $('SearchResults'),
			sidebar = $('NarrowSearch'),
			newSidebar = this.content[0],
			newResults = this.content[1];
		if (results) {
			newResults.replaces(results).fade('in');
		}

		if (sidebar) {
			newSidebar.replaces(sidebar);
		}

		SearchResult.setupUI();

		return this;
	}

});

SearchResult.$cache = {};
SearchResult.fetch = function(url) {
	var result = SearchResult.$cache[url];
	if (SearchResult.$loading && SearchResult.$loading != result) {
		SearchResult.$loading.request.cancel();
		SearchResult.$loading = null;
	}
	if (result) {
		//we've requested this page before
		result.show();
	} else {
		//go get 'em
		result = SearchResult.$cache[url] = new SearchResult(url);
		result.load();
	}
};

SearchResult.page = function(url) {
	window.history.pushState(null, "Search", String(url));
	SearchResult.fetch(String(window.location));
};

SearchResult.setupUI = function() {
	var copies = $('CopiesFilter');
	if (copies) {
		var cSlider = copies.getElement('.slider'),
			cKnob = cSlider.getElement('.knob'),
			cValue = copies.getElement('.slider-value'),
			cSteps = cSlider.get('data-steps'),
			steps = [0, 1, 2, 5, 10];

		//try parsing steps from data-attribute
		if (cSteps) {
			cSteps = cSteps.substring(1, cSteps.length -1);
			steps = cSteps.split(',').map(function(i) { return i.toInt(); });
		}

		var initialStep = Math.max(0 ,steps.indexOf(cValue.get('text').toInt()));

		var copiesSlider = new Slider(cSlider, cKnob, {
			//snap: true,
			steps: steps.length - 1,
			initialStep: initialStep,
			onChange: function(step) {
				cValue.set('text', steps[step]);
			},
			onComplete: function(step) {
				var loc = new URI(String(window.location)),
					oldCopies = loc.getData('copies');

				// no need to fetch a page if copies==undefined and
				// steps[step] = 0
				if (!(oldCopies || steps[step]) || (oldCopies == steps[step])) 
					return;
				
				loc.setData('copies', steps[step]);
				SearchResult.page(loc);
			}
		});
	}
};


window.addEvent('domready', function() {
	//cool browsers only
	if (!(window.history && history.pushState)) return;

	Element.NativeEvents.popstate = 2;
	
	$('app-body').addEvent('click:relay(a)', function(e, a) {
		if (a.pathname == window.location.pathname) {
			e.preventDefault();
			SearchResult.page(a.get('href'));
		}
	});

	$('Search').addEvent('submit', function(e) {
		e.preventDefault();
		var loc = new URI(String(window.location)),
			q = this.getElement('input[name=q]');
		if (loc.getData('q') != q.value) {
			loc.setData('q', q.value);
			SearchResult.page(loc);
		}
	});

	window.addEvent('popstate', function(e) {
		SearchResult.fetch(String(window.location));
	});

	SearchResult.setupUI();
});
