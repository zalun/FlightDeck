
/*
 * Default onFailure in all Requests
 */

Request = Class.refactor(Request, {
    options: {
        headers: {
            "X-CSRFToken": Cookie.read('csrftoken')
        },
        onFailure: function(xhr) {
            if (this.options.addOnFailure) {
              this.options.addOnFailure();
            }
			if (xhr.status !== 0 && xhr.responseText) {
                response = xhr.responseText;
                if (this.headers['X-Request'] == 'JSON') {
                    try {
                        response = JSON.decode(response);
                    } catch(err) {
                        // u'some string' is not valid JSON
                    }
                }
				fd.error.alert(xhr.statusText, response);
			}
        }
    },
  // overloading processScripts to *not* execute JS responses
    processScripts: function(text){
        if (this.options.evalResponse) return Browser.exec(text);
        return text.stripScripts(this.options.evalScripts);
    }
});

XPIRequest = new Class({
    Extends: Request,
    options: {
        onFailure: function(xhr) {
            this.cancel_callback();
            if (xhr.status == 404) {
                // XPI failed to produce, display an error with message
                fd.error.alert('XPI not built', xhr.responseText);
            } else {
                if (this.options.addOnFailure) {
                  this.options.addOnFailure();
                }
                if (xhr.status !== 0 && xhr.responseText) {
                    fd.error.alert(
                        '{statusText}'.substitute(xhr),
                        '{responseText}'.substitute(xhr)
                        );
                }
            }
        }
    },
    initialize: function(cancel_callback, options) {
        this.cancel_callback = cancel_callback;
        this.parent(options);
    }
});

// Add volatile events to Element, Window and Events
// from http://jsfiddle.net/ZVbWP/
Events.implement({
    addVolatileEvent: function(type, fn, counter, internal){
        if(!counter) {
            counter = 1;
        }
        var volatileFn = function(){
            fn.apply(this, arguments);
            counter -= 1;
            if(counter < 1) {
                this.removeEvent(type, volatileFn);
            }
        };
        this.addEvent(type, volatileFn, internal);
    }
});

/*
 * Class: FlightDeck
 * Initializes all needed functionality
 */

var FlightDeck = new Class({
    Implements: [Options, Events],
    options: {
        menu_el: 'UI_Editor_Menu',
        try_in_browser_class: 'XPI_test',
        xpi_hashtag: '',        // hashtag for the XPI creation
        max_request_number: 50, // how many times should system try to download XPI
        request_interval: 2000  // try to download XPI every 2 sec
        //user: ''
    },
    initialize: function() {
        this.tests = {}; // placeholder for testing spinners
        this.uri = new URI();
        if (this.uri.getData('redirect','fragment')) {
            window.location.href = this.uri.getData('redirect', 'fragment');
        }
        this.warning = this.error = this.message = {
            'alert': function(title, message) {
                alert(title+"\n"+message);
            }
        };
        this.editors = [];
        this.parseTooltips();
        this.createActionSections();
        this.parseTestButtons.bind(this).delay(10);
        this.addEvent('xpi_downloaded', this.whenXpiDownloaded);
        this.addEvent('xpi_installed', this.whenXpiInstalled);
        this.addEvent('xpi_uninstalled', this.whenXpiUninstalled);
        //if (!this.isAddonInstalled()) $log('FD: No Addon Builder Helper')
    },

    parseTooltips: function() {
        this.tips = new Tips({
            fixed: false,
            className: 'UI_tooltip',
            offset: {
                x: 0,
                y: 16
            }
        });

        $$('div.UI_tooltip_source').each(function(tipSource){
            tipSource.hide();
            var target = $(tipSource.get('data-tooltip-for'));
            target.set('title', '');
            target.store('tip:title', tipSource.get('data-tooltip-title'));
            target.store('tip:text', tipSource.get('html'));
            this.tips.attach(target);
        }, this);
    },

    setURIRedirect: function(url) {
        // change the URL add #/path/to/saved/revision
        if (this.uri.get('directory') != url) {
            this.uri.setData({'redirect': url}, false, 'fragment');
            this.uri.go();
        }
    },

    whenXpiInstalled: function(name) {
        this.parseTestButtons();
        this.message.alert('Add-on Builder', 'Add-on installed');
        $log('FD: INFO: Add-on installed');
    },

    whenXpiDownloaded: function(hashtag) {
    },

    whenXpiUninstalled: function() {
        this.parseTestButtons();
        this.message.alert('Add-on Builder', 'Add-on uninstalled');
    },

    /*
    Method: whenAddonInstalled
    create listener for a callback function
     */
    whenAddonInstalled: function(callback) {
        var removeListener = function() {
            document.body.removeEventListener('addonbuilderhelperstart', callback, false);
        };
        document.body.addEventListener('addonbuilderhelperstart', callback, false);
        (function() {
            $log('FD: Warning: not listening to addonbuilderhelperstart, is Helper installed?');
            removeListener();
        }).delay(100000);
    },

    parseTestButtons: function() {
        var installed = (this.isAddonInstalled()) ? this.isXpiInstalled() : false;
        if (installed) {
            $$('.{try_in_browser_class} a'.substitute(this.options)).each(function(test_button){
                if (installed && installed.installedID == test_button.get('data-jetpackid')) {
                    test_button.getParent('li').addClass('pressed');
                } else {
                    test_button.getParent('li').removeClass('pressed');
                }
            }, this);
        }
    },

    /*
     * Method: downloadXPI it's running in Request's scope
     */
    downloadXPI: function(response) {
        var time = fd.options.request_interval;
        
        $log('FD: DEBUG: XPI delayed ... try to load every ' + time/1000 + ' seconds' );
        var hashtag = this.options.data.hashtag;
        var filename = this.options.data.filename;
        fd.tests[hashtag].download_request_number = 0;
        
        fd.tests[hashtag].download_ID = fd.tryDownloadXPI.periodical(
                time, fd, [hashtag, filename]);
    },

    /*
     * Method: tryDownloadXPI
     *
     * Try to download XPI
     * if finished - stop periodical, stop spinner
     */
    tryDownloadXPI: function(hashtag, filename) {
        var test_request = this.tests[hashtag];
        if (!test_request.download_xpi_request || (
                    test_request.download_xpi_request &&
                    !test_request.download_xpi_request.isRunning())) {
            test_request.download_request_number++;
            var url = '/xpi/check_download/'+hashtag+'/';
            $log('FD: DEBUG: checking if ' + url + ' is prepared');
            test_request.download_xpi_request = new Request.JSON({
                method: 'get',
                url: url,
                timeout: fd.options.request_interval,
                onSuccess: function(response) {
                    if (response.ready || test_request.download_request_number > 50) {
                        clearInterval(test_request.download_ID);
                        test_request.spinner.destroy();
                    }
                    if (response.ready) {
                        var url = '/xpi/download/'+hashtag+'/'+filename+'/';
                        $log('FD: downloading ' + filename + '.xpi from ' + url );
                        window.open(url, 'dl');
                    }
                },
                addOnFailure: function() {
                    clearInterval(test_request.download_ID);
                    test_request.spinner.destroy();
                }
            }).send();
        }
    },

    /*
     * Method: testXPI 
     *
     * it's running in Request's scope
     */
    testXPI: function(response) {
        $log('FD: DEBUG: XPI delayed ... try to load every ' + fd.options.request_interval/1000 + ' seconds' );
        var hashtag = this.options.data.hashtag;
        fd.tests[hashtag].request_number = 0;
        fd.tryInstallXPI.delay(1000, fd, hashtag);
        fd.tests[hashtag].install_ID = fd.tryInstallXPI.periodical(
                fd.options.request_interval, fd, hashtag);
    },

    isXpiInstalled: function() {
        return window.mozFlightDeck.send({cmd:'isInstalled'});
    },

    /*
     * Method: tryInstallXPI
     *
     * Try to download XPI
     * if successful - stop periodical
     */
    tryInstallXPI: function(hashtag) {
        if (this.alertIfNoAddOn()) {
            var test_request = this.tests[hashtag];
            if (!test_request.install_xpi_request || (
                        test_request.install_xpi_request &&
                        !test_request.install_xpi_request.isRunning())) {
                test_request.request_number++;
                url = '/xpi/test/'+hashtag+'/';
                $log('FD: installing from ' + url);
                var cancel_callback = function() {
                    clearInterval(test_request.install_ID);
                    test_request.spinner.destroy();
                };
                test_request.install_xpi_request = new XPIRequest(
                    cancel_callback, {
                    method: 'get',
                    url: url,
                    headers: {'Content-Type': 'text/plain; charset=x-user-defined'},
                    onSuccess: function(responseText) {
                        if (responseText || test_request.request_number > 50) {
                            cancel_callback();
                        }
                        if (responseText) {
                            if (fd.item) {
								this.fireEvent('xpi_downloaded', hashtag);
							}
                            var result = window.mozFlightDeck.send({
                                cmd: "install", contents: responseText
                            });
                            if (result && result.success) {
                                this.fireEvent('xpi_installed', '');
                            } else {
                                if (result) $log(result);
                                this.warning.alert(
                                    'Add-on Builder',
                                    'Wrong response from Add-on Builder Helper. Please <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=573778">let us know</a>'
                                );
                            }
                        } else if (test_request.request_number > 50) {
                            this.warning.alert(
                                'Add-on Builder',
                                'The add-on was not successfully built (attempts timed out). Please try again.'
                            );
                        }
                    }.bind(this)
                }).send(this);
            } else {
                $log('FD: DEBUG request is running');
            }
        }
    },
    /*
     * Method: uninstallXPI
     *
     * Remove Add-on from Browser
     */
    uninstallXPI: function(jid) {
        $log('FD: uninstalling ' + jid);
        var result = window.mozFlightDeck.send({cmd:'uninstall'});
        if (result.success) this.fireEvent('xpi_uninstalled');
    },
    /*
     * Method: enableMenuButtons
     */
    enableMenuButtons: function() {
        $$('.' + this.options.menu_el + ' li').each(function(menuItem){
            if (menuItem.hasClass('disabled')){
                menuItem.removeClass('disabled');
            }
        });
    },

    generateHashtag: function(id_number) {
        return (Number.random(0,9) + '' + id_number + Date.now()).toInt().toString(36);
    },

    isAddonInstalled: function() {
        return (window.mozFlightDeck) ? true : false;
    },

    /*
     * Method: alertIfOldHelper
     * Show a warning if old add-on builder helper is installed
     */
    alertIfOldHelper: function() {
        if (settings.addons_helper_version && window.mozFlightDeck) {
            response = window.mozFlightDeck.send({cmd: 'version'});
            if (!response.success || response.msg < settings.addons_helper_version) {
                fd.warning.alert(
                        'Upgrade Add-on Builder Helper',
                        'There is a newer version ({addons_helper_version}) available.<br/> Please install <a href="{addons_helper}">the current one</a>.'.substitute(settings));
            } else alert('WTF?')
        }
    },



    /*
     * Method: alertIfNoAddOn
     */
    alertIfNoAddOn: function(callback, text, title) {
        this.alertIfOldHelper();
        if (this.isAddonInstalled()) return true;
        text = [text,
                "To test this add-on, please install the <a id='install_addon_helper' href='{addons_helper}'>Add-on Builder Helper add-on</a>".substitute(settings)].pick();
        title = [title, "Install Add-on Builder Helper"].pick();
        fd.warning.alert(title, text);
        return false;
    },
    /*
     * Method: createActionSections
     */
    createActionSections: function(){
        $$('.UI_Editor_Menu_Separator').each(function(separator){
            separator.getPrevious('li').addClass('UI_Section_Close');
            separator.getNext('li').addClass('UI_Section_Open');
        });

        var UI_Editor_Menu_Button = $$('.UI_Editor_Menu_Button');

        if (UI_Editor_Menu_Button.length === 1){
            UI_Editor_Menu_Button[0].addClass('UI_Single');
        }
    }
});

/*
 * Add delay do Spinner
 */

Spinner = Class.refactor(Spinner, {
    options: { 
        delay: 400,
        maskBorder: true
    },
    initialize: function(target, options) {
        this.previous(target, options);
    },
    position: function() {
        this.previous();
        this.unmaskBorder();
    },
    unmaskBorder: function() {
        $log('DEBUG: Spinner is unmaskingBorder');
        //1. change height/width to not cover border
        var el = this.element,
            oldHeight = el.getStyle('height').toInt(),
            oldWidth = el.getStyle('width').toInt(),
            oldLeft = el.getStyle('left').toInt();
            oldTop = el.getStyle('top').toInt();
            computedSize = this.target.getComputedSize({
                styles: ['padding']
            });

        el.setStyle('width', computedSize.totalWidth);
        el.setStyle('height', computedSize.totalHeight);

        //2. change top/left to not cover border
        var newLeft = oldLeft + (oldWidth - computedSize.totalWidth) / 2,
            newTop = oldTop + (oldHeight - computedSize.totalHeight) / 2;
        el.setStyle('left', newLeft);
        el.setStyle('top', newTop);
        
        //3. add border-radius if needed
        var computed = document.defaultView.getComputedStyle(this.target, null);
        var radiusProps = [
            'border-bottom-left-radius',
            'border-bottom-right-radius',
            'border-top-left-radius',
            'border-top-right-radius'
        ];
        radiusProps.forEach(function(prop) {
            var value = computed.getPropertyValue(prop);
            if (value) {
                el.setStyle(prop, value);
            }
        });
    }
});


/*
 * Inspired by
 * http://github.com/jeresig/sizzle/commit/7631f9c3f85e5fa72ac51532399cb593c2cdc71f
 * and this http://github.com/jeresig/sizzle/commit/5716360040a440041da19823964f96d025ca734b
 * and then http://dev.jquery.com/ticket/4512
 */

Element.implement({

    isHidden: function(){
        var w = this.offsetWidth, h = this.offsetHeight,
        force = (this.tagName.toLowerCase() === 'tr');
        return (w===0 && h===0 && !force) ? 
            true : (w!==0 && h!==0 && !force) ? false : this.getStyle('display') === 'none';
    },
    isVisible: function(){
        return !this.isHidden();
    },
    getSiblings: function(match,nocache) {
        return this.getParent().getChildren(match,nocache).erase(this);
    }

});

/*
    Add $name mutator - specifies the type of the created Class
    Usage:
        var C = new Class({$name = 'sometype', inititate: function() {}});
        var c = new C();
        alert(typeOf(c)); // 'sometype'
 */
Class.Mutators.$name = function(name){ this.implement('$family', {name: name}); };


/*
 * Add validation for alphanum + "-_."
 */
Form.Validator.addAllThese([
    ['validate-alphanum_plus', {
        errorMsg:     'Please use only letters (a-z), <br/>'+
                    'numbers (0-9) or \"_.-\" only in this field.<br/>'+
                    'No spaces or other characters are allowed.',
        test: function(element){
            return Form.Validator.getValidator('IsEmpty').test(element) ||  (/^[a-zA-Z0-9._\-]+$/).test(element.get('value'));
        }
    }],
    ['validate-alphanum_plus_space', {
        errorMsg:     'Please use only letters (a-z), <br/>'+
                    'numbers (0-9) spaces or \"_().-\" only in this field.<br/>'+
                    'No other characters are allowed.',
        test: function(element){
            return Form.Validator.getValidator('IsEmpty').test(element) ||  (/^[a-zA-Z0-9\ _\(\).\-]+$/).test(element.get('value'));
        }
    }]
]);


(function(){
    var html_symbols = ['&','"','<','>','¡','¢','£','¤','¥','¦','§','¨','©','ª','«','¬','®','¯','°','±','²','³','´','µ','¶','·','¸','¹','º','»','¼','½','¾','¿'],
    html_names = ['&amp;','&quot;','&lt;','&gt;','&iexcl;','&cent;','&pound;','&curren;','&yen;','&brvbar;','&sect;','&uml;','&copy;','&ordf;','&laquo;','&not;','&reg;','&macr;','&deg;','&plusmn;','&sup2;','&sup3;','&acute;','&micro;','&para;','&middot;','&cedil;','&sup1;','&ordm;','&raquo;','&frac14;','&frac12;','&frac34;','&iquest;'],
    js_symbols = ['\\(','\\)','\\{','\\}'],
    html_number = ['\(','\)','\{','\}'];

    String.implement({
        escapeHTML: function() {
            text = this;
            html_symbols.each(function(symbol, i){
                text = text.replace(new RegExp(symbol, 'g'), html_names[i]);
            });
            return text;
        },
        escapeJS: function() {
            text = this;
            js_symbols.each(function(symbol, i){
                text = text.replace(new RegExp(symbol, 'g'), html_number[i]);
            });
            return text;
        },
        escapeAll: function() {
            return this.escapeHTML(); //.escapeJS();
        }
    });
})();



/*
    Listen to an event fired when Extension is installed
    This wasn't working
window.addEvent('load', function() {
    if (window.mozFlightDeck) {
        window.mozFlightDeck.whenMessaged(function(data) {
            // This gets called when one of our extensions has been installed
            // successfully, or failed somehow.
            fd.message.alert('Add-on Builder', 'Add-on {msg}'.substitute(data));
            // log to console result of isInstalled command
            $log('sending isInstalled to window.mozFlightDeck');
            $log(fd.isXpiInstalled());
        });
    }
});
 */

// reset the class="emptyreset" fields
window.addEvent('domready', function() {
    $$('.emptyreset').forEach(function(el) {
        el.set('value', '');
    });
});
