var Class = require('shipyard/class/Class'),
	Request = require('shipyard/http/Request'),
	dom = require('shipyard/dom'),
	object = require('shipyard/utils/object'),
	URI = require('shipyard/utils/URI'),
	
	Slider = require('../views/Slider');

var LOADING_CLASS = 'loading';

var SearchResult = module.exports = new Class({
	
	initialize: function(url) {
		this.url = url;
	},

	load: function() {
		SearchResult.$loading = this;
		var spinner = dom.$('SearchResults');
		spinner.addClass(LOADING_CLASS);
		this.request = new Request({
			url: this.url,
			method: 'get',
			onSuccess: function(response) {
				if (SearchResult.$loading === this) {
					SearchResult.$loading = null;
				}
				var temp = new dom.Element('div', { html: response });
				this.content = temp.getElements('section');
				this.show();
			}.bind(this),
			onComplete: function() {
				spinner.removeClass(LOADING_CLASS);
			}
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

		var results = dom.$('SearchResults'),
			sidebar = dom.$('NarrowSearch'),
			newSidebar = this.content[0],
			newResults = this.content[1];
		if (results) {
			newResults.replace(results);
		}

		if (sidebar) {
			newSidebar.replace(sidebar);
		}

		if (!this.ui) {
			SearchResult.setupUI(this);
		} else {
			var loc = new URI(this.url);
			object.forEach(this.ui.sliders, function(slider, name) {
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
	if (SearchResult.$loading && SearchResult.$loading !== result) {
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
	dom.window.getNode().history.pushState(null, "Search", String(url));
	SearchResult.fetch(String(dom.window.get('location')));
};

SearchResult.setupUI = function(result) {
	var ui = { sliders: {} };
    if (result) {
		result.ui = ui;
	}

    var slidersMap = {
        'Activity': {
            0: 'Inactive',
            1: 'Stale',
            2: 'Low',
            3: 'Moderate',
            4: 'High',
            5: 'Rockin\''
        }
    };

    var filters = ['Copies', 'Used', 'Activity'];
    filters.forEach(function(filter) {
        var container = dom.$(filter + 'Filter'),
            dataKey = filter.toLowerCase();

        if (container && !container.hasClass('disabled')) {
        
            var sliderEl = container.getElement('.slider'),
                knobEl = sliderEl.getElement('.knob'),
                valueEl = container.getElement('.slider-value'),
                rangeEndEl = sliderEl.getElement('.range.end'),
                end = parseInt(rangeEndEl.get('text'), 10) || parseInt(rangeEndEl.get('data-value'), 10);

            var initialStep = Math.max(0, parseInt(valueEl.get('text'), 10) || 0);
        
            var slider = new Slider(sliderEl, knobEl, {
                //snap: true,
                range: [0, end],
                initialStep: initialStep,
                onChange: function(step) {
                    var map = slidersMap[filter];
                    valueEl.set('text', map ? map[step] : step);
                },
                onComplete: function(step) {
                    if (!this.sanityCheck) {
						return;
					}

                    var loc = new URI(String(dom.window.get('location')));
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
        } else {
            // If a slider is disabled, it's because it's facet no
            // longer has results. So, we should remove the facet from
            // the URL
            var loc = new URI(String(dom.window.get('location')));

            var oldData = Number(loc.getData(dataKey));
            if (oldData) {
                loc.setData(dataKey, 0);
                SearchResult.page(loc);
            }
        }
    });
};

