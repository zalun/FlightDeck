var Class = require('shipyard/class/Class'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    $ = dom.$,
    Request = require('shipyard/http/Request'),
    
    PackageRevision = require('../models/PackageRevision'),
    Module = require('../models/Module');

module.exports = new Class({

    //Extends: Controller?,

    Implements: Options,

    options: {
        modules: [],
        attachments: [],
        dependencies: [],
        folders: [],
        readonly: false,
        package_info_el: 'package-properties',
        copy_el: 'package-copy',
        test_el: 'try_in_browser',
        download_el: 'download',
        console_el: 'error-console',
        save_el: 'package-save',
        menu_el: 'UI_Editor_Menu',
        

        check_if_latest: true  // switch to false if displaying revisions

    },
    
    package: null,

    //junk
    data: {},

    modules: {},
    attachments: {},

    initialize: function PackageController(package, options) {
        var controller = this;
        
        this.package = package;
        this.setOptions(options);
        // reset version_name (in case of reload)
        var versionEl = this.versionEl = dom.$('version_name');
        if (versionEl) {
            versionEl.set('value', package.get('version_name'));
            package.observe('version_name', function(name) {
                versionEl.set('value', name);
            });
        
        }

        this.instantiate_modules();
        this.instantiate_attachments();
        this.instantiate_folders();
        this.instantiate_dependencies();
        // hook event to menu items
        this.revision_list_btn = $('revisions_list')
        this.revision_list_btn.addEvent('click', function(e) {
            controller.showRevisionList();
        });
        if (this.package.isAddon()) {
            this.boundTestAddon = this.testAddon.bind(this);
            this.test_el = $(this.options.test_el);
            this.options.test_url = this.test_el.getElement('a').get('href');
            this.test_el.addEvent('click', function(e) {
                e.preventDefault();
                controller.testAddon();
            });

            this.download_el = $(this.options.download_el);
            this.options.download_url = this.download_el.getElement('a').get('href');
            this.download_el.addEvent('click', function(e) {
                e.preventDefault();
                controller.downloadAddon();
            });
        }
        this.copy_el = $(this.options.copy_el)
        if (this.copy_el) {
            this.copy_el.addEvent('click', function(e) {
                e.preventDefault();
                controller.copyPackage();
            });
        }
        if (this.options.check_if_latest) {
            dom.window.addEvent('focus', function() {
                controller.checkIfLatest(this.askForReload);
            });
        }

        this.packageInfoEl = $(this.options.package_info_el);
        this.packageInfoEl.addEvent('click', function(e) {
            e.preventDefault();
            controller.showInfo();
        });

        this.setupButtonTooltips();
    },

    instantiate_modules: function() {
        // iterate by modules and instantiate Module
        this.options.modules.forEach(function(module) {
            module.readonly = this.options.readonly;
            module.append = true;
            this.modules[module.filename] = new Module(this,module);
        }, this);
    },

    instantiate_attachments: function() {
        // iterate through attachments
        this.options.attachments.forEach(function(attachment) {
            attachment.readonly = this.options.readonly;
            attachment.append = true;
            this.attachments[attachment.uid] = new Attachment(this,attachment);
        }, this);
    },

    instantiate_dependencies: function() {
        // iterate through attachments
        this.options.dependencies.forEach(function(plugin) {
            plugin.readonly = this.options.readonly;
            plugin.append = true;
            this.libraries[plugin.id_number] = new Library(this,plugin);
        }, this);
    },
    
    instantiate_folders: function() {
        this.options.folders.forEach(function(folder) {
            folder.append = true;
            this.folders[folder.root_dir + '/' + folder.name] = new Folder(this, folder);
        }, this);
    },


    showRevisionList: function() {
                  
    },

    setupButtonTooltips: function() {
        if(typeof FloatingTips === 'undefined') {
            return false;
        }

        this.tips = new FloatingTips('.UI_Editor_Menu .UI_Editor_Menu_Button', {
            position: 'top',
            balloon: true
        });
    },

    checkIfLatest: function(failCallback) {
        // we want to make a request each time, since the author could
        // have created new changes while we were looking.
        var controller = this;

        PackageRevision.find({
            conditions: { package: this.package.get('pk') },
            options: { limit: 1, order_by: '-revision_number' },
            callback: function(r) {
                r = r[0];
                if (r.get('revision_number') > controller.package.get('revision_number')) {
                    failCallback.call(controller);
                }
            }
        })
    },

    askForReload: function() {
        fd.warning.alert(
            'New revision detected', 
            'There is a newer revision available. <a href="'+ 
            this.options.latest_url +'">Click this link to go to it now.</a>'
        );
    },

    /*
     * Method: copyPackage
     * create a new Package with the same name for the current user
     */
    copyPackage: function() {
        if (!settings.user) {
            fd.alertNotAuthenticated();
            return;
        }
        
        if (fd.edited) {
            fd.error.alert("There are unsaved changes", 
                    "To make a copy, please save your changes.");
            return;
        }
        new Request.JSON({
            url: this.options.copy_url,
            useSpinner: true,
            spinnerTarget: this.copy_el.getElement('a'),
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
            onSuccess: function(response) {
                window.location.href = response.view_url;
            }
        }).send();
    },

    downloadAddon: function(e) {
        if (e) {
          e.stop();
        }
        var el = $(this.options.download_el).getElement('a');

        fd.tests[this.options.hashtag] = {
            spinner: new Spinner(el, {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            }).show()
        };
        data = {
            hashtag: this.options.hashtag, 
            filename: this.options.name
        };
        new Request.JSON({
            url: this.options.download_url,
            data: data,
            onSuccess: fd.downloadXPI
        }).send();
    },

    testAddon: function(){
        var el;
        if (fd.alertIfNoAddOn()) {
            if (e) {
                el = e.target;
            } else {
                el = $(this.options.test_el);
            }
            if (el.getParent('li').hasClass('pressed')) {
                fd.uninstallXPI(el.get('data-jetpackid'));
            } else {
                this.installAddon();
            }
        } else {
            fd.whenAddonInstalled(function() {
                fd.message.alert(
                    'Add-on Builder Helper',
                    'Now that you have installed the Add-on Builder Helper, loading the add-on into your browser for testing...'
                );
                this.testAddon();
            }.bind(this));
        }
    },

    installAddon: function() {
        if (this._test_request && this._test_request.isRunning()) {
            $log('FD: DEBUG: Test request already running. Cancelling second attempt');
            return;
        }
        
        var spinner = new Spinner($(this.options.test_el).getElement('a'), {
            img: {
                'class': 'spinner-img spinner-16'
            },
            maskBorder: false
        }).show()
        fd.tests[this.options.hashtag] = {
            spinner: spinner
        };
        var data = this.data || {};
        data['hashtag'] = this.options.hashtag;
        this._test_request = new Request.JSON({
            url: this.options.test_url,
            data: data,
            onSuccess: fd.testXPI,
            onFailure: function() {
                spinner.destroy();
            }
        }).send();
    },

    generateHashtag: function() {
        if (this.getOption('readonly')) return;
        this.options.hashtag = fd.generateHashtag(this.options.id_number);
    },

    //Package.View
    showInfo: function() {
        fd.displayModal(this.options.package_info);
    }

});
