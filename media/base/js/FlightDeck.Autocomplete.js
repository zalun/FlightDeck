/* 
 * File: FlightDeck.Autocomplete.js
 */

FlightDeck.Autocomplete = new Class({
	Implements: [Options],
	options: {
		value_el: 'library_id_number',
		display_el: 'new_library',
		value_field: 'id_number',
		url: '/autocomplete/library/'
	},
	initialize: function(options) {
		this.setOptions(options);
		this.create();
	},

	create: function(content) {
		var input = $(this.options.display_el);
		
		this.autocomplete = new Meio.Autocomplete.Select(
			input, 
			this.options.url, {
			valueField: $(this.options.value_el),
			valueFilter: function(data) {
				return data.id_number
			},
			filter: {
				type: 'contains',
				path: 'full_name'
			}
		});
		
		var warning = this.warning = new Element('div.autocomplete.roar.tip.warning', {
			html: '<div class="roar-bg"></div><h3>No libraries found.</h3><p>Check your spelling?</p>'
		}).inject(input, 'after');
		warning.position({
			relativeTo: input,
			position: 'centerRight',
			edge: 'centerLeft',
			offset: {
				x: 30
			}
		}).hide();
		
		this.autocomplete.addEvent('deselect', function() {
			console.log('hide')
			warning.hide();
		});
		this.autocomplete.addEvent('noItemToList', function(els) {
			console.log('show')
			warning.show();
		});
		return this.autocomplete;
	},
	
	positionNextTo: function(target) {
		target = $(target || this.options.display_el);
		this.autocomplete.elements.list.positionNextTo(target);
	}
	
});
