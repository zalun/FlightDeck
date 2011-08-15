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
		if (!this.content) {
			if (!(this.request && this.request.isRunning())) {
				this.load();
			} else {
				// loading, so dont worry, it will show soon
			}
			return this;
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

		if (!this.slider) {
			this.slider =  SearchResult.setupUI();
		} else {
			this.slider.sanityCheck = false;
			var loc = new URI(this.url);
			this.slider.set(loc.getData('copies') || 0);
			this.slider.sanityCheck = true;
		}

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
			cRangeEnd = cSlider.getElement('.range.end'),
			end = cRangeEnd.get('text').toInt();

		var initialStep = Math.max(0, cValue.get('text').toInt() || 0);
	
		var copiesSlider = new Slider(cSlider, cKnob, {
			//snap: true,
			range: [0, end],
			initialStep: initialStep,
			onChange: function(step) {
				cValue.set('text', step);
			},
			onComplete: function(step) {
				if (!this.sanityCheck) return;

				var loc = new URI(String(window.location));
				loc.setData('copies', step);
				SearchResult.page(loc);
			}
		});
		// onComplete gets triggered many times when no dragging
		// actually occurred, because we set a range and initialStep. To
		// prevent those fake onComplete's from trigger anything, we
		// check our sanity by stopping all onComplete's that happen
		// during initialization, since sanityCheck get's set to true
		// _after_ construction.
		copiesSlider.sanityCheck = true;

		return copiesSlider;
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
