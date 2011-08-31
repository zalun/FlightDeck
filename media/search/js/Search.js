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
			method: 'get',
			spinnerTarget: 'SearchResults',
			onSuccess: function(tree, elements, html) {
				if (SearchResult.$loading == this) SearchResult.$loading = null;
				this.content = tree;
				this.show();
			}.bind(this)
		}).send('xhr');

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

		if (!this.ui) {
			SearchResult.setupUI(this);
		} else {
			var loc = new URI(this.url);
		    Object.each(this.ui.sliders, function(slider, name) {
                slider.sanityCheck = false;
			    slider.set(loc.getData(name) || 0);
			    slider.sanityCheck = true;
            });	
            
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

SearchResult.setupUI = function(result) {
	var ui = { sliders: {} };
    if (result) result.ui = ui;

    var filters = ['Copies', 'Used'];
    filters.forEach(function(filter) {
        var container = $(filter + 'Filter'),
            dataKey = filter.toLowerCase();

        if (container) {
        
            var sliderEl = container.getElement('.slider'),
                knobEl = sliderEl.getElement('.knob'),
                valueEl = container.getElement('.slider-value'),
                rangeEndEl = sliderEl.getElement('.range.end'),
                end = rangeEndEl.get('text').toInt();

            var initialStep = Math.max(0, valueEl.get('text').toInt() || 0);
        
            var slider = new Slider(sliderEl, knobEl, {
                //snap: true,
                range: [0, end],
                initialStep: initialStep,
                onChange: function(step) {
                    valueEl.set('text', step);
                },
                onComplete: function(step) {
                    if (!this.sanityCheck) return;

                    var loc = new URI(String(window.location));
                    loc.setData(dataKey, step);
                    SearchResult.page(loc);
                }
            });
            // onComplete gets triggered many times when no dragging
            // actually occurred, because we set a range and initialStep. To
            // prevent those fake onComplete's from trigger anything, we
            // check our sanity by stopping all onComplete's that happen
            // during initialization, since sanityCheck get's set to true
            // _after_ construction.
            slider.sanityCheck = true;

            ui.sliders[dataKey] = slider;
        }
    });
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
