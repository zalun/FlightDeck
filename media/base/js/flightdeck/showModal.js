var Modal = require('./Modal'),
    dom = require('shipyard/dom'),
    object = require('shipyard/utils/object'),
    string = require('shipyard/utils/string');

exports.displayModal = function(content) {
    var modal = new Modal({
        dragHandle: 'h3',
        draggable: true,
        content: content
    });
    modal.show();
    return modal;
};

var question = {
	ok: 'OK',
	id: '',
	cancel: 'Cancel',
	focus: true
};
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
exports.showQuestion = function(data) {
    var buttons = '',
        template,
        display,
        textboxes,
        main_callback,
        _buildButtons = function(data){
            return [{
				id: string.uniqueID(),
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
    data = object.merge({}, question, data);
    if (!data.buttons) {
        data.buttons = _buildButtons(data);
    }
    data.buttons.reverse().forEach(function(button){
        if (!button['class']) {
            button['class'] = button.type;
        }
        var li = '<li>' +
                '<input id="{id}" type="{type}" value="{text}" ' +
                'class="{class}Modal';
        if (button['default']) {
            li += ' defaultCallback';
        }
        if (button.irreversible) {
            li += ' irreversible';
        }
        li += '"/></li>';
		buttons += string.substitute(li, button);
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
    display = this.displayModal(string.substitute(template, data));
    data.buttons.forEach(function(button){
        var button_el = dom.$(button.id);
        if (button_el) {
			button_el.addListener('click', function(e) {
				if (button.callback) {
					button.callback(e);
				}
				display.destroy();
			});
        }
        if (button['default']) {
            main_callback = button.callback;
        }
    });
    
    //auto focus first input if it exists
    //also listen for the enter key if a text input exists
    var enterHandle = dom.window.addListener('keydown', function(e) {
        if (e.key === 'enter') {
            e.stop();
            if (main_callback) {
                main_callback();
                display.destroy();
            }
        }
    });
    display.addEvent('destroy', function() {
        enterHandle.detach();
    });
    
    textboxes = dom.$(display).getElements('input[type="text"]');
    
    if (data.focus && textboxes.length) {
        display.addListener('show', function() {
            setTimeout(function() {
                textboxes[0].focus();
            }, 5);
        });
    }
    
    
    return display;
};
