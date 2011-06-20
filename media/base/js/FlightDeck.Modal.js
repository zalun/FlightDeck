/* 
 * File: Flightdeck.Modal.js
 */

FlightDeck = Class.refactor(FlightDeck,{
	options: {
		modalWrap: {
			start: '<div class="UI_Modal_Wrapper"><div class="UI_Modal">',
			end: '</div></div>'
		},
		question: {
			ok: 'OK',
			id: '',
			cancel: 'Cancel',
			focus: true
		}
	},
	initialize: function(options) {
		this.modal = new ModalWindow();
		this.setOptions(options);
		this.previous(options);
		this.modals = {};
	},
	/*
	 * Method: displayModal
	 * Pretty dummy function which just wraps the content with divs and shows on the screen
	 */
	makeModal: function(content) {
		// copy options
		var data = $H(this.options.modalWrap).getClean();
		data['content'] = content;
		var modal_el = Elements.from('{start}{content}{end}'.substitute(data));
		var key = new Date().getTime();
		modal_el.store('modalKey', key);
		this.modals[key] = modal_el;
		return modal_el;
	},
	/*
	 * Method: displayModal
	 * Pretty dummy function which just wraps the content with divs and shows on the screen
	 */
	displayModal: function(content) {
		// modal is defined in base.html - this should probably be done elsewhere
		return this.modal.create(this.makeModal(content)[0]);
	},
	// these two are not really used atm
	hideModal: function(key) {
		this.modals[key].hide();
	},
	destroyModal: function(key) {
		this.modals[key].destroy();
	},

    /*
     * Method: showQuestion
     * Display Modal with a question and wait for answers
     * 
       :params: 
            data: object with following info:
                title: title of the modal
                message: message to be displayed inside the modal (it's
                        gonna be wrapped in <p>
                focus: Boolean - should first input steals focus?
                buttons: array of button objects constructed like
                    class: String - suffix 'Modal' will be added
                    text: String - text to be displayed
                    type: String ('button','reset') type of the input
                    id: button DOM id (required if callback)
                    callback: function to call back after click
                    default: Boolean - which action should be
                             taken on Enter
                    irreversible: Boolean - adds irreversible className which
                                  results in different graphic style
                // backward compatibility (ok and cancel buttons only)
                ok: text for OK button (default OK)
                cancel: text for CANCEL button (default Cancel)
                callback: callback for the OK button
                id: id of the OK button
     
     */
	showQuestion: function(data) {
        var buttons = '',
            template,
            display,
            textboxes,
            main_callback,
            _buildButtons = function(data){
                return [{
                    type: 'reset',
                    text: data.cancel,
                    'class': 'close'
                },{
                    id: data.id,
                    type: 'button',
                    text: data.ok,
                    'class': 'submit',                    
                    callback: data.callback,
                    'default': true
                }];
            };
		data = Object.merge({}, this.options.question, data);
        if (!data.buttons) {
            data.buttons = _buildButtons(data);
        }
        data.buttons.reverse().forEach(function(button){
            if (!button.class) {
                button.class = button.type;
            }
            li = '<li>'
                + '<input id="{id}" type="{type}" value="{text}" '
                    + 'class="{class}Modal';
            if (button.default) {
                li += ' defaultCallback';
            }
            if (button.irreversible) {
                li += ' irreversible';
            }
            li += '"/>';
            +'</li>'
            buttons += li.substitute(button);
        });
		template = '<div id="display-package-info">'+
							'<h3>{title}</h3>'+
							'<div class="UI_Modal_Section">'+
								'<p>{message}</p>'+
							'</div>'+
							'<div class="UI_Modal_Actions">'+
								'<ul>'+
                                    buttons +
								'</ul>'+
							'</div>'+
						'</div>';
		display = this.displayModal(template.substitute(data));
        data.buttons.forEach(function(button){
            var button_el = $(button.id);
            if (button_el) {
                button_el.addEvent('click', button.callback);
                button_el.addEvent('click', display.destroy.bind(display));
            }
            if (button['default']) {
                main_callback = button.callback;
            }
        });
		
		//auto focus first input if it exists
		//also listen for the enter key if a text input exists
		function pressEnter(e) {
			e.stop();
			if(main_callback) {
				main_callback();
				display.destroy();
			}
		}
		
		window.addEvent('keyup:keys(enter)', pressEnter);
		display.addEvent('destroy', function() {
			window.removeEvent('keyup:keys(enter)', pressEnter);
		});
		
		textboxes = $(display).getElements('input[type="text"]');
		
		if (data.focus && textboxes.length) {
			display.addEvent('onDisplay', function() {
				setTimeout(function() {
					$log(uid, 'focus', textboxes[0]);
					textboxes[0].focus();
				}, 5);
			});
		}
		
		
		return display;
	}
});
