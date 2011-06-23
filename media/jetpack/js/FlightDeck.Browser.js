/*
 * Extending Flightdeck with Browser functionality 
 * loading XPI from saved objects
 */ 
(function(){
    var browser_test_item = function(el) {
        el.addEvent('click', function(e){
            e.stop();
            var hashtag = this.get('data-hashtag');
            var testThisXpi = function() {
                fd.tests[hashtag] = {
                    'spinner': new Spinner(
                                this.getParent('li.UI_Item')).show()
                };
                new Request.JSON({
                    url: el.get('href'),
                    data: {'hashtag': hashtag},
                    onSuccess: fd.testXPI,
                    addOnFailure: function() {
                        fd.tests[hashtag].spinner.destroy();
                    }
                }).send();
            }.bind(this);
            if (fd.alertIfNoAddOn()) {
                if (el.getParent('li').hasClass('pressed')) {
                    fd.uninstallXPI(el.get('data-jetpackid'));
                } else {
                    testThisXpi();
                }
            } else {
                fd.whenAddonInstalled(function() {
                    fd.message.alert(
                        'Add-on Builder Helper', 
                        'Now that you have installed the Add-on Builder '
                        + 'Helper, loading the add-on into your browser for '
                        + 'testing...'
                    );
                    testThisXpi();
                }.bind(this));
            }
        });
    };

    var browser_disable_item = function(el) {
        if (el.get('href')) el.addEvent('click', function(e){
            if (e) e.stop();
            this.store('spinner', 
                new Spinner(this.getParent('li.UI_Item')).show());
            new Request.JSON({
                url: el.get('href'),
                onSuccess: function(response) {
                    el.retrieve('spinner').destroy();
                    el.getParent('li.UI_Item').destroy();
                    fd.message.alert(response.message_title, response.message);
                    fd.fireEvent('deactivate_' + response.package_type);
                    if ($('activate')) {
                        $('activate').addEvent('click', function(e2){
                            e2.stop();
                            new Request.JSON({
                                url: this.get('href'),
                                onSuccess: function(response) {
                                    window.location.reload();
                                }
                            }).send();
                        });
                    }
                }
            }).send();
        });
    };

    var browser_activate_item = function(el) {
        if (el.get('href')) el.addEvent('click', function(e){
            if (e) e.stop();
            this.store('spinner', 
                new Spinner(this.getParent('li.UI_Item')).show());
            new Request.JSON({
                url: this.get('href'),
                onSuccess: function(response) {
                    el.retrieve('spinner').destroy();
                    this.getParent('li.UI_Item').destroy();
                    fd.message.alert(response.message_title, response.message);
                    fd.fireEvent('activate_' + response.package_type);
                }.bind(this)
            }).send();
        });
    };

    var browser_delete_item = function(el) {
        el.addEvent('click', function(e){
            if (e) e.stop();
            var itemEl = this.getParent('.UI_Item');
            fd.showQuestion({
                title: "Deleting Package with all revisions", 
                message: "Are you sure you want to delete this Package ?"
                        + "</p><p>There is no undo.",
                buttons: [{
                        type: 'reset',
                        text: 'Cancel',
                        'class': 'close'
                    },{
                        type: 'submit',
                        text: 'DELETE',
                        id: 'delete_package',
                        irreversible: true,
                        callback: function(e2) {
                                new Request.JSON({
                                    url: this.get('href'),
                                    useSpinner: true,
                                    spinnerTarget: itemEl,
                                    onSuccess: function(response) {
                                        itemEl.destroy();
                                        fd.message.alert(
                                            response.message_title, response.message
                                        );
                                    }
                                }).send();
                            }.bind(this),
                        'default': true
                    }]
            });
        });
    };

    var change_no = function(a, b, inc) {
        if ($(a) && $(b)) {
            $(a).set('text', parseInt($(a).get('text')) + inc);
            $(b).set('text', parseInt($(b).get('text')) - inc);
        }
    }; 

    var on_activate_library = function() {
        change_no('public_libs_no', 'private_libs_no', 1);
    }; 

    var on_deactivate_library = function() {
        change_no('public_libs_no', 'private_libs_no', -1);
    }; 

    var on_activate_addon = function() {
        change_no('public_addons_no', 'private_addons_no', 1);
    }; 

    var on_deactivate_addon = function() {
        change_no('public_addons_no', 'private_addons_no', -1);
    }; 

    FlightDeck = Class.refactor(FlightDeck,{
        options: {
            try_in_browser_class: 'XPI_test',
            disable_class: 'UI_Disable',
            activate_class: 'UI_Activate',
            delete_class: 'UI_Delete'
        },
        initialize: function(options) {
            this.setOptions(options);
            this.previous(options);
            $$('.{try_in_browser_class} a'.substitute(this.options)).each(
                    browser_test_item);
            $$('.{disable_class} a'.substitute(this.options)).each(
                    browser_disable_item);
            $$('.{activate_class} a'.substitute(this.options)).each(
                    browser_activate_item);
            $$('.{delete_class} a'.substitute(this.options)).each(
                    browser_delete_item);
            this.addEvent('activate_l', on_activate_library);
            this.addEvent('deactivate_l', on_deactivate_library);
            this.addEvent('activate_a', on_activate_addon);
            this.addEvent('deactivate_a', on_deactivate_addon);
        }
    });
})();
