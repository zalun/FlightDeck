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
        $$('.UI_AMO_Upload_New_Version a').addEvent('click', this.uploadToAMO.bind(this));
        $$('.UI_AMO_Upload_New_Addon a').addEvent('click', this.uploadToAMO.bind(this));
        $$('.UI_AMO_Info').each(this.getStatusFromAMO, this);
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
			url: el.get('data-upload_url'),
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
                this.getStatus.delay(5000, this, el.getParent('.UI_AMO_Info'));
			}.bind(this),
            addOnFailure: function() {
                this.getStatus.delay(500, this, el.getParent('.UI_AMO_Info'));
            }.bind(this)
		}).send();
    },

    /*
     * Method: getStatusFromAMO
     * pull Add-o status from AMO and update data on the page
     */
    getStatusFromAMO: function(status_el) {
        if (!status_el.get('data-uploaded')) {
            return;
        }
        new Request.JSON({
            url: status_el.get('data-pull_info_url'),
            useSpinner: true,
            spinnerTarget: status_el.getElements('h2')[0],
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
            onSuccess: function(response) {
                this.updateStatus(status_el, response);
            }.bind(this)
        }).send();
    },

    /*
     * Method: getStatus
     * pull Add-o status and update data on the page
     */
    getStatus: function(status_el) {
        var pk = status_el.get('data-revision_id');
        new Request.JSON({
            url: status_el.get('data-get_addon_info_url'),
            useSpinner: true,
            spinnerTarget: status_el.getElements('h2')[0],
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
            onSuccess: function(response) {
                this.updateStatus(status_el, response);
                if (!status_el.get('data-uploaded')) {
                    status_el.set('data-uploaded', 1)
                }
                // repeat every 10s if still no answer from AMO was
                // saved
                if (response.status_code && response.status_code == -1) {
                    this.getStatus.delay(10000, this, status_el);
                }
            }.bind(this)
        }).send();
    },
    /*
     * Method: updateStatus
     * update data on the page
     */
    updateStatus: function(status_el, data) {
        var update = function(className, content) {
            status_el.getElements(className)[0].set('text', content).highlight();
        };
        if (data.status) update('.amo-review_status', data.status);
        if (data.version) update('.amo-latest_version', data.version);
        if (data.pk) status_el.set('data-revision_id', data.pk) ;
        if (data.view_on_amo_url && data.status_code > 0) {
            var view_on_amo = status_el.getElements('.UI_AMO_View_On_AMO')[0];
            view_on_amo.getElements('a')[0].set('href', data.view_on_amo_url);
            view_on_amo.removeClass('hidden');
        }
        if (data.hasOwnProperty('uploaded')) {
            status_el.set('data-uploaded', data.uploaded);
            if (data.uploaded) {
                // remove ability to upload
                var li_anchor = $$('.upload_link')[0],
                    anchor = li_anchor.getElement('a');
                li_anchor.set('text', anchor.get('text'));
                anchor.destroy();
                li_anchor.removeClass('UI_AMO_Version_Uploaded').removeClass('UI_AMO_Version_Uploaded');
                li_anchor.addClass('UI_AMO_Version_Uploaded');
                li_anchor.highlight();
            }
        }
    }
});
