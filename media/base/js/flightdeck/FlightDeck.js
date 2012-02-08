/*globals alert*/
var Class = require('shipyard/class/Class'),
	Options = require('shipyard/class/Options'),
	EventEmitter = require('shipyard/class/Events'),
	dom = require('shipyard/dom'),
	Request = require('shipyard/http/Request'),
	object = require('shipyard/utils/object'),
	string = require('shipyard/utils/string'),
	log = require('shipyard/utils/log'),
	
	Roar = require('./Roar'),
	settings = dom.window.get('settings');

function ABH() {
	return dom.window.get('mozFlightDeck');
}

function wrapRoar(roar, name, duration) {
	return function _roar(title, message) {
		roar.alert(title, message, {
			className: 'roar ' + name,
			duration: duration
		});
	};
}

module.exports = new Class({

    Implements: [Options, EventEmitter],

    options: {
        menu_el: 'UI_Editor_Menu',
        try_in_browser_class: 'XPI_test',
        xpi_hashtag: '',        // hashtag for the XPI creation
        max_request_number: 50, // how many times should system try to download XPI
        request_interval: 2000  // try to download XPI every 2 sec
        //user: ''
    },

	warning: {},
	error: {},
	message: {},

    initialize: function(options) {
		this.setOptions(options);
		var fd = this;
        this.tests = {}; // placeholder for testing spinners
		this.roar = new Roar({ position: 'topRight' });

		var roars = {
			warning: 8000,
			error: 20000,
			message: 4000
		};

		object.forEach(roars, function(duration, name) {
			this[name].alert = wrapRoar(this.roar, name, duration);
		}, this);

		// compatibility with Django messages
		// http://docs.djangoproject.com/en/dev/ref/contrib/messages/#message-tags
		this.success = this.info = this.message;
		this.debug = this.warning;
		this.parseMessages();

        this.editors = [];
        this.createActionSections();
		setTimeout(function() {
			fd.parseTestButtons();
		}, 10);
        this.addListener('xpi_downloaded', this.whenXpiDownloaded);
        this.addListener('xpi_installed', this.whenXpiInstalled);
        this.addListener('xpi_uninstalled', this.whenXpiUninstalled);

		dom.$('app-body').delegate('.truncate', 'click', function(e) {
			var tmp = this.get('data-text');
			this.set('data-text', this.get('text'));
			this.set('text', tmp);
		});
    },

    whenXpiInstalled: function(name) {
        this.message.alert('Add-on Builder', 'Add-on installed');
        this.parseTestButtons();
        log.info('Add-on installed');
    },

    whenXpiDownloaded: function(hashtag) {
    },

    whenXpiUninstalled: function() {
        log.info('Add-on uninstalled');
        this.message.alert('Add-on Builder', 'Add-on uninstalled');
        this.parseTestButtons();
    },

    /*
    Method: whenAddonInstalled
    create listener for a callback function
     */
    whenAddonInstalled: function(callback) {
        var handle = dom.document.body.addListener('addonbuilderhelperstart', callback);
        setTimeout(function() {
            log.warn('not listening to addonbuilderhelperstart, is Helper installed?');
            handle.detach();
        }, 1000 * 100);
    },

	/*
     * Method: parseMessages
     * Parses DOM to find elements with fd_{type_of_message}
     * displays messages and removes elements from DOM
     */
	parseMessages: function() {
		['message', 'warning', 'error', 'success', 'info', 'debug'].forEach(function(name) {
			dom.$$('.fd_' + name).forEach(function(el) {
				this[name].alert(el.get('title') || name, el.get('html'));
				el.destroy();
			}, this);
		}, this);
	},

    parseTestButtons: function() {
        if (!this.isAddonInstalled()) {
			return;
		}
        ABH().send('isInstalled').then(function(response) {
            if (response.success) {
                dom.$$(string.substitute('.{try_in_browser_class} a', this.options))
                .forEach(function(test_button){
                    if (response.installedID === test_button.get('data-jetpackid')) {
                        test_button.getParent('li').addClass('pressed');
                    } else {
                        test_button.getParent('li').removeClass('pressed');
                    }
                }, this);
            }
        }.bind(this));
    },

    /*
     * Method: downloadXPI
     */
    downloadXPI: function(data) {
        var time = this.options.request_interval;
		var fd = this;
        
        log.debug('XPI delayed ... try to load every %d seconds', time / 1000);
        var hashtag = data.hashtag;
        var filename = data.filename;
        this.tests[hashtag].download_request_number = 0;
        
        this.tests[hashtag].download_ID = setInterval(function() {
			fd.tryDownloadXPI(hashtag, filename);
		}, time);
    },

    /*
     * Method: tryDownloadXPI
     *
     * Try to download XPI
     * if finished - stop periodical, stop spinner
     */
    tryDownloadXPI: function (hashtag, filename) {
		var fd = this;
        var test_request = this.tests[hashtag];
        if (!test_request.download_xpi_request || (
                    test_request.download_xpi_request &&
                    !test_request.download_xpi_request.isRunning())) {
            test_request.download_request_number++;
            var url = '/xpi/check_download/' + hashtag + '/';
            log.debug('checking if ' + url + ' is prepared (attempt ' +
					test_request.download_request_number + '/50)');
            var r = test_request.download_xpi_request = new Request({
                method: 'get',
                url: url,
                timeout: fd.options.request_interval,
                onSuccess: function(response) {
                    try {
                        response = JSON.parse(response);
                    } catch (jsonError) {
                        log.warning('JSON error: ', jsonError);
                        return;
                    }
                    if (response.ready || test_request.download_request_number > 50) {
                        clearInterval(test_request.download_ID);
                        test_request.spinner.removeClass('loading');
						if (!response.ready) {
							fd.error.alert('XPI download failed',
								'XPI is not yet prepared, giving up');
						}
                    }
                    if (response.ready) {
                        var url = '/xpi/download/'+hashtag+'/'+filename+'/';
                        log.debug('downloading ' + filename + '.xpi from ' + url );
                        dom.window.getNode().open(url, 'dl');
                    }
                }
            });

			r.addListener('failure', function() {
                clearInterval(test_request.download_ID);
                test_request.spinner.removeClass('loading');
			});
			r.send();
        }
    },

    /*
     * Method: testXPI
     */
    testXPI: function(data) {
		var fd = this;
        log.debug('XPI delayed ... try to load every ' + fd.options.request_interval/1000 + ' seconds' );
        var hashtag = data.hashtag;
        this.tests[hashtag].request_number = 0;
        setTimeout(function() {
			fd.tryInstallXPI(hashtag);
		}, 1000);
        this.tests[hashtag].install_ID = setInterval(function() {
			fd.tryInstallXPI(hashtag);
		}, this.options.request_interval);
    },

    /*
     * Method: tryInstallXPI
     *
     * Try to download XPI
     * if successful - stop periodical
     */
    tryInstallXPI: function(hashtag) {
		var fd = this;

        if (this.alertIfNoAddOn()) {
            var test_request = this.tests[hashtag];
            if (!test_request.install_xpi_request || (
                        test_request.install_xpi_request &&
                        !test_request.install_xpi_request.isRunning())) {
                test_request.request_number++;
                var url = '/xpi/test/'+hashtag+'/';
                log.debug('installing from ' + url);
                var cancel_callback = function() {
                    clearInterval(test_request.install_ID);
                    test_request.spinner.removeClass('loading');
                };
                test_request.install_xpi_request = new Request({
                    method: 'get',
                    url: url,
                    headers: {'Content-Type': 'text/plain; charset=x-user-defined'},
                    onSuccess: function(responseText) {
                        if (responseText || test_request.request_number > 50) {
                            cancel_callback();
                        }
                        if (responseText) {
                            if (fd.item) {
								this.emit('xpi_downloaded', hashtag);
							}
                            ABH().send("install", responseText).then(function(response) {
                                if (response && response.success) {
                                    this.emit('xpi_installed', '');
                                } else {
                                    if (response) {
                                        log.debug('Unsuccessful response:', response);
                                    }
                                    this.warning.alert(
                                        'Add-on Builder',
                                        'Wrong response from Add-on Builder Helper. ' +
                                        'Please <a href="https://bugzilla.mozilla.org/' +
                                        'show_bug.cgi?id=573778">let us know</a>'
                                    );
                                }
                            }.bind(this));
                        } else if (test_request.request_number > 50) {
                            this.warning.alert(
                                'Add-on Builder',
                                'The add-on was not successfully built ' +
                                '(attempts timed out). Please try again.'
                            );
                        }
                    }.bind(this),
					onFailure: function() {
						cancel_callback();
						if (this.xhr.status === 404) {
							fd.error.alert('XPI not built', this.xhr.responseText);
						} else if (this.xhr.status !== 0 && this.xhr.responseText) {
							fd.error.alert(this.xhr.statusText, this.xhr.responseText);
						}
					}
                }).send();
            } else {
                log.debug('request is running');
            }
        }
    },
    /*
     * Method: uninstallXPI
     *
     * Remove Add-on from Browser
     */
    uninstallXPI: function() {
        ABH().send('uninstall').then(function(response){
            if (response.success) {
                this.emit('xpi_uninstalled');
            }
        }.bind(this));
    },
    /*
     * Method: enableMenuButtons
     */
    enableMenuButtons: function() {
        dom.$$('.' + this.options.menu_el + ' li').forEach(function(menuItem){
            if (menuItem.hasClass('disabled')){
                menuItem.removeClass('disabled');
            }
        });
    },

    generateHashtag: function(id_number) {
        return parseInt('' + id_number + (new Date()).getTime(), 10).toString(36);
    },

    isAddonInstalled: function() {
        return ABH() ? true : false;
    },

    /*
     * Method: alertIfOldHelper
     * Show a warning if old add-on builder helper is installed
     */
    alertIfOldHelper: function() {
        // run this only once per request
        var that = this;
        if (this.old_helper_checked) {
			return;
		}
        if (settings.addons_helper_version && ABH()) {
            if (!ABH().send({cmd: 'version'}).then) {
                that.warning.alert(
                    'Upgrade Add-on Builder Helper',
                    string.substitute('Your version is not compatible with' +
                        ' the Builder. <br/>There is a newer one ' +
                        '({addons_helper_version}) available.<br/> ' +
                        'Please install <a href="{addons_helper}">' +
                        'the current one</a>.<br/>', settings));
            }
            ABH().send('version').then(function (response){
                that.old_helper_checked = true;
                if (!response.success || response.msg < settings.addons_helper_version) {
                    that.warning.alert(
                        'Upgrade Add-on Builder Helper',
                        string.substitute('There is a newer version ' +
                            '({addons_helper_version}) available.<br/> ' +
                            'Please install <a href="{addons_helper}">' +
                            'the current one</a>.', settings));
                }
            });
        }
    },



    /*
     * Method: alertIfNoAddOn
     */
    alertIfNoAddOn: function(callback, text, title) {
        this.alertIfOldHelper();
        if (this.isAddonInstalled()) {
			return true;
		}
        text = text ||
			string.substitute('To test this add-on, please install the '+
                    '<a id="install_addon_helper" href="{addons_helper}">'+
                    'Add-on Builder Helper add-on</a>', settings);
        title = title || 'Install Add-on Builder Helper';
        this.warning.alert(title, text);
        return false;
    },
    /*
     * Method: createActionSections
     */
    createActionSections: function(){
        dom.$$('.UI_Editor_Menu_Separator').forEach(function(separator){
            separator.getPrevious('li').addClass('UI_Section_Close');
            separator.getNext('li').addClass('UI_Section_Open');
        });

        var UI_Editor_Menu_Button = dom.$$('.UI_Editor_Menu_Button');

        if (UI_Editor_Menu_Button.length === 1){
            UI_Editor_Menu_Button[0].addClass('UI_Single');
        }
    }
});
