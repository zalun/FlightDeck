FlightDeck = Class.refactor(FlightDeck, {
    options: {upload_package_modal: ''},
    initialize: function(options) {
        this.previous(options);
        var self = this;
        if (document.id('upload-package')) {
            document.id('upload-package').addEvent('click', function(ev) {
                if (ev) ev.stop();
                self.displayModal(self.options.upload_package_modal);
                document.id('upload-package-submit').addEvent('click', function(eve){
                  // here add in JS functionality
                  // it will be needed for interactive upload which will support 
                  // adding Libraries
                })
            })
        }
        $$('.UI_AMO_Upload_New_Version a').addEvent('click', this.uploadToAMO);
        $$('.UI_AMO_Upload_New_Addon a').addEvent('click', this.uploadToAMO);
    },

    /*
     * Method: uploadToAMO
     * create XPI and upload it to AMO
     */
    uploadToAMO: function(e) {
        if (e) e.stop();
        else {
            fd.error.alert('System error', 
                    'FlightDeck.uploadToAMO needs to be called with event');
            return
        }
        var el = e.target.getParent('li');
        $log(el);

		new Request.JSON({
			url: el.get('data-url'),
            useSpinner: true,
            spinnerTarget: el.getElement('a'),
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			onSuccess: function(response) {
                fd.message.alert('Uploading to AMO (' + settings.amooauth_domain +')', 
                                 'We\'ve scheduled the Add-on to upload<br/>' +
                                 'Check the upload status and complete the process on your ' + 
                                 '<a href="' + settings.amooauth_protocol + 
                                 '://' + settings.amooauth_domain + 
                                 '/en-US/developers/addons" target="amo_dashboard">AMO dashboard</a>');
			}
		}).send();

    },
});
