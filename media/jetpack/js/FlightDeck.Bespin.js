// Extend FlightDeck with Bespin features

var FDBespin = new Class({
	Implements: [Options, Events],
	options: {
		validSyntaxes: ['js', 'html', 'plain', 'css']
	},
	initialize: function(element, options) {
		var self = this;
		this.setOptions(options);
		$log('FD: initializing bespin on ' + element.get('tag') + '#' + element.get('id'));
		bespin.useBespin(element, {
			stealFocus: true
		}).then(function(env){
				self.element = env.editor;
				self.ready();
			});
		window.addEvent('resize', function() {
			if (!self.element) {
				$log('FD: resizing window: fd.bespin.element undefined')
				return;
			}
			self.element.dimensionsChanged();
		});
	},
	ready: function() {
		$log('FD: Bespin is ready');
        if (!fd.item.options.modules.length) {
          this.setContent('\n\n\n<-- Please create a module in the left '
              +'sidebar to start entering code for this library.');
        } 
		this.fireEvent('ready');
		var self = this;
		this.element.textChanged.add(function() {
			self.fireEvent('change');
		});
	},
	setContent: function(value) {
        this.unloading = true;
		this.element.value = '';
        this.loading = true;
		this.element.value = value;
		return this;
	},
	getContent: function() {
		return this.element.value;
	},
	setSyntax: function(syntax) {
		if (!this.options.validSyntaxes.contains(syntax)) {
			if (syntax == 'json') {
			    syntax = 'js'
			} else {
			    syntax = 'plain'
			}
		}
		// XXX Switched off as incompatible with MooTools
		this.element.syntax = syntax;
		return this;
	}
});

Class.refactor(FlightDeck, {
	initialize: function(options) {
		this.previous(options);
		this.editor_contents = {};
		this.current_editor = false;
		this.bespin_editor = new Element('div',{
			'text': '',
			'id': 'bespin_editor',
			'class': 'UI_Editor_Area'
		}).inject($('editor-wrapper'), 'top');
		if (window.bespinLoaded) {
            $log('FD: initializing Bespin together with FlightDeck ')
			this.initializeBespin();
		} else {
			$log('FD: setting bespinLoad');
			window.onBespinLoad = this.initializeBespin.bind(this);
		}
	},
	saveCurrentEditor: function() {
		if (this.current_editor) {
			this.editor_contents[this.current_editor] = this.bespin.getContent();
		}
	},
	switchBespinEditor: function(editor_id, syntax) {
		$log('FD: switching Bespin to {e} with syntax {s}'.substitute({e:editor_id, s:syntax}));
		this.saveCurrentEditor();
		this.current_editor = editor_id;
		this.bespin.setContent(this.editor_contents[editor_id]);
		this.bespin.setSyntax(syntax);
	},
	cleanBespin: function() {
		this.bespin.setContent('');
	},
	initializeBespin: function() {
		this.bespin = new FDBespin(this.bespin_editor);
		this.bespin.addEvents({
			'change': function() {
                // this should check if it's simply a switch of files!
                if (this.bespin.unloading || this.bespin.loading) {
                  if (this.bespin.unloading) this.bespin.unloading = false;
                  if (this.bespin.loading) this.bespin.loading = false;
                } else {
                  this.fireEvent('change');
                }
			}.bind(this),
			'ready': function() {
				this.bespinLoaded = true;
				this.fireEvent('bespinLoad');
			}.bind(this)
		});
	}
});

window.bespinLoaded = false;
window.onBespinLoad = function() {
	// this theoretically can happen before fd is initialized
    window.bespinLoaded = true;
	$log('FD: bespin loaded');
};
