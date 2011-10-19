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
        folders: []
    },
    
    package: null,

    //junk
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
			this.options.test_url = $(this.options.test_el).getElement('a').get('href');
			$(this.options.test_el).addEvent('click', this.boundTestAddon);
            if (!this.boundDownloadAddon) {
                this.boundDownloadAddon = this.downloadAddon.bind(this);
            }
			this.options.download_url = $(this.options.download_el).getElement('a').get('href');
			$(this.options.download_el).addEvent('click', this.boundDownloadAddon);
		}
		this.copy_el = $(this.options.copy_el)
		if (this.copy_el) {
			this.copy_el.addEvent('click', this.copyPackage.bind(this));
		}
        if (this.options.check_if_latest) {
            window.addEvent('focus', function() {
                this.checkIfLatest(this.askForReload.bind(this));
            }.bind(this));
        }

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
        (typeof console !== 'undefined') && console.warn('no Button Tooltips!');
        return false;

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
                    failCallback();
                }
            }
        })
    }

});
