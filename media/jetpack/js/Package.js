/*
 * File: jetpack.Package.js
 */

/*
 * Javascript Package/PackageRevision representation
 */

var Package = new Class({

	Implements: [Options, Events],

	options: {
		// data
			// package specific
				// id_number: '',
				// full_name: '',
				// name: '',
				// revision_string: '',
				// description: '',
				// type: '', // 'a'/'l'
				// package_author: '',
				// url: '',
				// license: '',
				// package_version_name: '',
				// version_url: '', // link to the current version revision
				// latest_url: '', // link to the latest revision
				// check_latest_url: '' // link to check foir the latest url
			// revision specific data
				// revision_verion_name: '',
				// revision_number: '',
				// message: '', // commit message
				// dependecies: [], // list of names and urls
				// origin_url: '', // link to a revision used to created this one
				// revision_author: '',
				// modules: [], // a list of module filename, author pairs
		attachments: [],
		readonly: false,
		package_info_el: 'package-properties',
		copy_el: 'package-copy',
		test_el: 'try_in_browser',
		download_el: 'download',
		console_el: 'error-console',
        amo_upload_el: 'upload_to_amo',
        check_if_latest: true  // switch to false if displaying revisions
	},

	modules: {},

	attachments: {},

	libraries: {},
	
	folders: {},

	initialize: function(options) {
		this.setOptions(options);
        // create empty editor
        this.editor = new FDEditor('editor-wrapper');
        // reset version_name (in case of reload)
		if ($('version_name')) {
			$('version_name').set('value', this.options.version_name);
		}
        // initiate the sidebar 
		fd.sidebar.options.editable = !this.options.readonly;
		fd.sidebar.buildTree();
		this.instantiate_modules();
		this.instantiate_attachments();
		this.instantiate_folders();
		this.instantiate_dependencies();
		// hook event to menu items
		this.revision_list_btn = $('revisions_list')
        this.revision_list_btn.addEvent('click', this.show_revision_list);
		if (this.isAddon()) {
            this.boundTestAddon = this.testAddon.bind(this);
			this.options.test_url = $(this.options.test_el).getElement('a').get('href');
			$(this.options.test_el).addEvent('click', this.boundTestAddon);
            if (!this.boundDownloadAddon) {
                this.boundDownloadAddon = this.downloadAddon.bind(this);
            }
			this.options.download_url = $(this.options.download_el).getElement('a').get('href');
			$(this.options.download_el).addEvent('click', this.boundDownloadAddon);
            this.amo_upload_el = $(this.options.amo_upload_el);
            if (this.amo_upload_el) {
                if (!this.options.amo_upload_url) {
                    this.options.amo_upload_url = this.amo_upload_el.getElement('a').get('href');
                }
                this.amo_upload_el.addEvent('click', this.uploadToAMO.bind(this));
            }
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

	/*
	 * Method: checkIfLatest
	 * check if currently displayed revision is the latest one
	 * call fail_callback if not
	 */ 
	checkIfLatest: function(failCallback) {
		// ask backend for the latest revision number
		new Request.JSON({
			method: 'get',
			url: this.options.check_latest_url,
			onSuccess: function(response) {
				if (failCallback && this.options.revision_number != response.revision_number) {
					failCallback.call()
				}
			}.bind(this)
		}).send();
	},

	askForReload: function() {
		fd.warning.alert(
			'New revision detected', 
			'There is a newer revision available. <a href="'+ 
			this.options.latest_url +'">Click this link to go to it now.</a>'
		);
	},

    /*
     * Method: uploadToAMO
     * create XPI and upload it to AMO
     */
    uploadToAMO: function(e) {
        if (e) e.stop();

		new Request.JSON({
			url: this.options.amo_upload_url,
            //useSpinner: true,
            spinnerTarget: this.copy_el.getElement('a'),
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			onSuccess: function(response) {
                fd.message.alert('Uploading to AMO (addons.mozilla.org)', 
                                 'We\'ve scheduled the Add-on to upload<br/>' +
                                 'There is no need to wait for confirmation.');
			}
		}).send();

    },

	/*
	 * Method: copyPackage
	 * create a new Package with the same name for the current user
	 */
	copyPackage: function(e) {
		e.stop();
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

	testAddon: function(e){
		var el;
		if (e) e.stop();
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

	isAddon: function() {
		return (this.options.type == 'a');
	},
	
	generateHashtag: function() {
		this.options.hashtag = fd.generateHashtag(this.options.id_number);
	},
	
	setupButtonTooltips: function() {
		this.tips = new FloatingTips('.UI_Editor_Menu .UI_Editor_Menu_Button', {
			position: 'top',
			balloon: true
		});
	},

	instantiate_modules: function() {
		// iterate by modules and instantiate Module
		this.options.modules.each(function(module) {
			module.readonly = this.options.readonly;
			module.append = true;
			this.modules[module.filename] = new Module(this,module);
		}, this);
	},

	instantiate_attachments: function() {
		// iterate through attachments
		this.options.attachments.each(function(attachment) {
			attachment.readonly = this.options.readonly;
			attachment.append = true;
			this.attachments[attachment.uid] = new Attachment(this,attachment);
		}, this);
	},

	instantiate_dependencies: function() {
		// iterate through attachments
		this.options.dependencies.each(function(plugin) {
			plugin.readonly = this.options.readonly;
			plugin.append = true;
			this.libraries[plugin.id_number] = new Library(this,plugin);
		}, this);
	},
	
	instantiate_folders: function() {
		this.options.folders.each(function(folder) {
			folder.append = true;
			this.folders[folder.root_dir + '/' + folder.name] = new Folder(this, folder);
		}, this);
	},

	show_revision_list: function(e) {
		if (e) e.stop();
		var that = fd.getItem();
		new Request({
			method: 'get',
            useSpinner: true,
            spinnerTarget: that.revision_list_btn.getElement('a'),
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			url: that.options.revisions_list_html_url.substitute(that.options),
			onSuccess: function(html) {
				var modal = fd.displayModal(html),
					modalEl = $(modal).getElement('.UI_Modal'),
					showVersionsEl = modalEl.getElement('#versions_only');
				//setup handler for "Show versions only" checkbox
				function toggleVersionsOnly() {
					if (showVersionsEl.checked) {
						modalEl.addClass('boolean-on');
					} else {
						modalEl.removeClass('boolean-on');
					}
				}
				showVersionsEl.addEvent('change', function(e) {
					toggleVersionsOnly()
				});
				toggleVersionsOnly();
			}
		}).send();
	}
});

var File = new Class({
	
	Implements: [Options, Events],
	
	options: {
		path: null
		//events
			//onDestroy: function() {}
	},
	
	initialize: function(pack, options) {
		this.pack = pack;
		this.setOptions(options);
	},
	
	getShortName: function() {
		return this.getFullName().split('/').pop();
	},
	
	getFullName: function() {
		var name = this.options.filename;
		if(this.options.type) {
			name += '.' + this.options.type;
		}
		return name;
	},
	
	is_editable: function() {
		return ['css', 'txt', 'js', 'html'].contains(this.options.type);
	},
	
	destroy: function() {
		// refactor me
		if (this.textarea) this.textarea.destroy();
		//delete fd.editor_contents[this.get_editor_id()];
		if (this.active) {
			// switch editor!
			mod = null;
			// try to switch to first element
			first = false;
			Object.each(this.pack.modules, function(mod) {
				if (!first) {
					first = true;
					mod.switchTo();
					fd.sidebar.setSelectedFile(mod);
				}
			});
			if (!first) {
				this.pack.editor.setContent('');
			}
		}

        if(this.tab) {
            this.tab.destroy();
        
        }
		this.fireEvent('destroy');
	},

    onSelect: function() {
        this.fireEvent('select');
    },

	switchTo: function() {
		this.selectTab();
		this.pack.editor.switchTo(this);
		this.pack.editor.focus();
		this.fireEvent('showEditor');
	},
	
	makeTab: function() {
		var tab = this.tab = new FlightDeck.Tab(fd.tabs, {
			title: this.getShortName()
		});
        this.addEvent('change', function() {
            $(tab).addClass('modified');
        });
        this.addEvent('reset', function() {
            $(tab).removeClass('modified');
        })
		tab.file = this;
	},
	
	selectTab: function() {
		if(!this.tab) {
			this.makeTab();
		}
		fd.tabs.setSelected(this.tab);
	},

    setChanged: function(isChanged) {
        if (this.changed != isChanged) {
            this.fireEvent(isChanged ? 'change' : 'reset');
        }
        this.changed = isChanged;
    }
	
});

var Library = new Class({
	
	Extends: File,
	
	options: {
		append: true
	},
	
	initialize: function(pack, options) {
		this.parent(pack, options);
		
		this.addEvent('destroy', function(){
			delete pack.libraries[this.options.id_number];
		});
		
		if(this.options.append) {
			this.append();
		}
	},
	
	append: function() {
		fd.sidebar.addPlugin(this);
	},
	
	onSelect: function() {
		this.parent();
        //open in a new tab, of course
        window.open(this.options.view_url);
	},
	
	getID: function() {
		return 'Library-' + this.options.id_number;
	},
	
	getShortName: function() {
		return this.options.full_name;
	},
	
	getFullName: function() {
		return this.getID();
	},
	
	storeNewVersion: function(version_data) {
		this._latest_version = version_data;
	},
	
	retrieveNewVersion: function() {
		return this._latest_version;
	}
	
});

var Attachment = new Class({

	Extends: File,

	options: {
		code_trigger_suffix: '_attachment_switch', // id of an element which is used to switch editors
		code_editor_suffix: '_attachment_textarea', // id of the textarea
		active: false,
		type: 'js',
		append: false,
		filename: '',
		readonly: false,
		counter: 'attachments'
	},

	is_image: function() {
		return ['jpg', 'gif', 'png'].contains(this.options.type);
	},

	initialize: function(pack, options) {
		this.parent(pack, options);
		this.options.path = options.filename + '.' + options.type;
        // uid for editor items
        this.uid = this.getEditorID();

		if (this.options.append) {
			this.append();
		}
		this.addEvent('destroy', function(){
			delete pack.attachments[this.options.uid];
		});
		// create editor
		if (this.options.active && this.is_editable()) {
			this.switchTo();
		} else {
            pack.editor.registerItem(this);
        }
	},

	onSelect: function() {
		this.parent();
        if (this.is_editable()) {
			this.switchTo();
		} else {
			var template_start = '<div id="attachment_view"><h3>'
                +this.options.filename+'</h3><div class="UI_Modal_Section">';
			var template_end = '</div><div class="UI_Modal_Actions"><ul><li>'
                +'<input type="reset" value="Close" class="closeModal"/>'
                +'</li></ul></div></div>';
			var template_middle = 'Download <a href="'
                +this.options.get_url
                +'">'
                +this.options.filename
                +'</a>';
			if (this.is_image()) {
                template_middle += '<p></p>';
                var img = new Element('img', { src: this.options.get_url });
                var spinner;
                img.addEvent('load', function() {
                    if (spinner) spinner.destroy();
                    modal.position();
                });
            }
			var modal = this.attachmentWindow = fd.displayModal(template_start+template_middle+template_end);
            var target = $(this.attachmentWindow).getElement('.UI_Modal_Section p');
            if (target) {
                spinner = new Spinner(target);
				spinner.show();
                target.grab(img);
            }
		}
	},

	loadContent: function() {
		// load data synchronously
        var that = this,
			spinnerEl = $(this.tab);
		new Request({
			method: 'get',
			url: this.options.get_url,
			useSpinner: !!spinnerEl,
			spinnerTarget: spinnerEl,
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			onSuccess: function() {
                var content = this.response.text || '';
				that.content = content;
                that.original_content = content;
				that.fireEvent('loadcontent', content);
			}
		}).send();
	},
	
	isLoaded: function() {
		return this.content != null;
	},

	getID: function() {
		return 'Attachment-'+this.uid;
	},

    getEditorID: function() {
        return this.options.uid + this.options.code_editor_suffix;
    },

	append: function() {
		fd.sidebar.addData(this);
	},

    reassign: function(options) {
        // every revision, attachments that have changed get a new `uid`.
        // since Attachments are currently kept track of via the `uid`,
        // we must adjust all instances that keep track of this
        // attachment to use the new id, and any other new options that
        // comes with it

        var packAttachments = this.pack.attachments,
            editorItems = this.pack.editor.items,
            oldUID = this.options.uid;

        delete packAttachments[oldUID];

        this.setOptions(options);
        packAttachments[options.uid] = this;

        var editorUID = this.getEditorID();
        editorItems[editorUID] = editorItems[this.uid];
        delete editorItems[this.uid];
        this.uid = editorUID;

		if (options.append) {
			this.append();
		}

        if (this.tab) {
            this.tab.setLabel(this.getShortName());
        }
        this.fireEvent('reassign', this.options.uid);
    }

});

Attachment.exists = function(filename, ext) {
	return Object.some(fd.getItem().attachments, function(att) {
		return (att.options.filename == filename) &&
				att.options.type == ext;
	});
};

var Module = new Class({

	Extends: File,

	options: {
		// data
		// filename: '',
		// code: '',
		// author: '',
		// DOM
		code_trigger_suffix: '_switch', // id of an element which is used to switch editors
        suffix: '_module',
		readonly: false,
		main: false,
		executable: false,
		active: false,
		type: 'js',
		append: false,
		counter: 'modules'
	},

	initialize: function(pack, options) {
		this.parent(pack, options);
		this.options.path = this.options.filename + '.' + this.options.type;
		
		this.addEvent('destroy', function(){
			delete pack.modules[this.options.filename];
		});
		
		if (this.options.append) {
			this.append();
		}
        // an uid for the editor
        this.uid = this.options.filename + this.options.suffix;
		// create editor
        if (this.options.main || this.options.active) {
            this.switchTo();
        } else {
            pack.editor.registerItem(this);
        }
	},

	onSelect: function() {
		this.parent();
        this.switchTo();
	},

	append: function() {
		fd.sidebar.addLib(this);
    },
	
	loadContent: function() {
		// load data synchronously
		var spinnerEl = $(this.tab);
		new Request.JSON({
            method: 'get',
			url: this.options.get_url,
            useSpinner: !!spinnerEl,
            spinnerTarget: spinnerEl,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				},
                maskBorder: false
			},
            onSuccess: function(mod) {
                var code = mod.code || '';
				this.original_content = code;
                this.content = code;
                this.fireEvent('loadcontent', code);
            }.bind(this)
		}).send();
	},
	
	isLoaded: function() {
		return this.content != null;
	},
	
	getID: function() {
	    return 'Module-' + this.options.filename.replace(/\//g, '-');
	}
});

Module.exists = function(filename) {
	return Object.some(fd.getItem().modules, function(mod) {
		return mod.options.filename == filename;
	});
};

var Folder = new Class({
	
	Extends: File,
	
	options: {
		root_dir: 'l',
		name: ''
	},
	
	initialize: function(pack, options) {
		this.parent(pack, options);
		
		this.addEvent('destroy', function(){
			delete pack.folders[this.options.root_dir + '/' +this.options.name];
		});
		
		if (this.options.append) {
			this.append();
		}
	},
	
	append: function() {
		if (this.options.root_dir == Folder.ROOT_DIR_LIB) {
			fd.sidebar.addLib(this);
		} else if (this.options.root_dir == Folder.ROOT_DIR_DATA) {
			fd.sidebar.addData(this);
		}
	},
	
	onSelect: function() {
		this.parent();
        $log('selected a Folder');
	},
	
	getFullName: function() {
		return this.options.name;
	},
	
	getID: function() {
	    return this.options.root_dir + '-'+ 
	        this.options.name.replace(/\//g, '-');
	}
	
});

Folder.ROOT_DIR_LIB = 'l';
Folder.ROOT_DIR_DATA = 'd';

Folder.exists = function(filename, root_dir) {
	return Object.some(fd.getItem().folders, function(folder) {
		return (folder.options.root_dir == root_dir &&
				folder.options.name == filename);
	});
};

Package.View = new Class({

	Extends: Package,

	options: {
		readonly: true,
		// copy_url: '',
	},

	initialize: function(options) {
		this.setOptions(options);
		this.parent(options);
		$(this.options.package_info_el).addEvent('click', 
			this.showInfo.bind(this));
	},

	/*
	 * Method: showInfo
		 display a window with info about current Package
	 */

	showInfo: function(e) {
		e.stop();
		fd.displayModal(this.options.package_info);
	},

    generateHashtag: function() {}
});


Package.Edit = new Class({

	Extends: Package,
	
	options: {
		// DOM elements
			save_el: 'package-save',
			menu_el: 'UI_Editor_Menu',
			assign_library_el: 'assign_library_action',
			assign_library_input: 'library_id_number',
			add_module_el: 'add_module_action',
			add_module_input: 'add_module',

		// urls
			// save_url: '',
			// delete_url: '',
			// add_module_url: '',
			// assign_library_url: '',
			// switch_sdk_url: '',
		package_info_form_elements: ['full_name', 'package_description']
	},
	
	initialize: function(options) {
		this.setOptions(options);
        if (this.isAddon()) {
            this.boundDownloadAddon = this.downloadAddonOrSave.bind(this);
        }
        this.data = {};
		this.parent(options);
		this.prepareDependenciesInterval();
		this.assignActions();
        // generateHashtag needed only in edit mode
        fd.addEvent('xpi_downloaded', function() {
           this.generateHashtag(); 
        }.bind(this));
	},

	assignActions: function() {
		// assign menu items
        var that = this;
		this.appSidebarValidator = new Form.Validator.Inline('app-sidebar-form');
		$(this.options.package_info_el).addEvent('click', this.editInfo.bind(this));

		if (this.isAddon()) {
			$(this.options.console_el).addEvent('click', function(){
				window.mozFlightDeck.send({ cmd: 'toggleConsole', 
					contents: 'open' });
			});
		}
		this.setupSavePopupEvents();

		// save
		this.boundSaveAction = this.saveAction.bind(this);
		$(this.options.save_el).addEvent('click', this.boundSaveAction);

		// submit Info
		this.boundSubmitInfo = this.submitInfo.bind(this);

        
        // check if version_name changed
        
        $('version_name').addEvents({
			keyup: function(e) {
				if (e && e.key == 'enter') {
					that.save();
					e.stop();
				}
			},
            keydown: function(e) {
				if (e && e.key == 'enter') {
					e.stop();
				}
			}
        });
		if ($('jetpack_core_sdk_version')) {
			$('jetpack_core_sdk_version').addEvent('change', function() {
				new Request.JSON({
					url: this.options.switch_sdk_url,
                    useSpinner: true,
                    spinnerTarget: 'core_library_lib',
					spinnerOptions: {
						img: {
							'class': 'spinner-img spinner-16'
						}
					},
					data: {'id': $('jetpack_core_sdk_version').get('value')},
					onSuccess: function(response) {
						// set the redirect data to view_url of the new revision
						fd.setURIRedirect(response.view_url);
						// set data changed by save
						this.registerRevision(response);
						// change url to the SDK lib code
						$('core_library_lib').getElement('a').set(
							'href', response.lib_url);
						// change name of the SDK lib
						$('core_library_lib').getElement('span').set(
							'text', response.lib_name);
						fd.message.alert(response.message_title, response.message);
					}.bind(this)
				}).send();
			}.bind(this));
		}
		this.bind_keyboard();
	},

	setupSavePopupEvents: function() {
		var packageSave = $('package-save'),
			versionName = $('version_name'),
			revisionMsg = $('revision_message');

		packageSave.addEvent('mouseenter', function(e) {
			versionName.focus();
		});
		revisionMsg.addEvent('keypress', function(e) {
			if (e.key == 'tab') {
				e.preventDefault();
				packageSave.focus();
			}
		});

	},

	downloadAddonOrSave: function(e){
		if (e) {
		  e.stop();
        }
        var that = this;
        if (fd.edited) {
            // display message
            fd.showQuestion({
                title: 'You\'ve got unsaved changes.',
                message: 'Choose from the following options',
                buttons: [{
                    text: 'Cancel',
                    type: 'reset',
                    'class': 'close'
                },{
                    text: 'Download without saving',
                    id: 'downloadwithoutsaving',
                    'class': 'submit',
                    type: 'button',
                    callback: function(){
                        this.downloadAddon();
                    }.bind(this)
                },{
                    text: 'Save &amp; Download',
                    id: 'saveanddonload',
                    'class': 'submit',
                    type: 'button',
                    callback: function(){
                        fd.addVolatileEvent('save', this.boundDownloadAddon);
                        this.save();
                    }.bind(this),
                    'default': true
                }]
            });
        } else {
            this.downloadAddon(e);
        }
	},
	
    uploadAttachment: function(files, renameAfterLoad) {
		var self = this;
        var spinner = new Spinner($('attachments')).show();
        // renameAfterLoad is falsy or callable
        var file = files[0];
        
        var data = new FormData(),
            xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				try {
					var response = JSON.decode(xhr.responseText);
				} catch(ex) { 
                    $log(ex);
                    return;
                }
				
				
				if(xhr.status >= 200 && xhr.status < 300 && response) {
					//onSuccess
					
					fd.message.alert(response.message_title, response.message);
					var attachment = new Attachment(self,{
						append: true,
						active: true,
						filename: response.filename,
						ext: response.ext,
						author: response.author,
						code: response.code,
						get_url: response.get_url,
						uid: response.uid,
						type: response.ext
					});
					self.registerRevision(response);
					self.attachments[response.uid] = attachment;
					if (spinner) spinner.destroy();
					$log('FD: all files uploaded');
					Function.from(renameAfterLoad)(attachment);
				} else {
					//onError
					
					if (spinner) spinner.destroy();
					if (xhr) {
						fd.error.alert(
							'Error {status}'.substitute(xhr),
							'{statusText}<br/>{responseText}'.substitute(xhr)
						);
					} else {
						fd.error.alert('Error', 'File size was too big');
					}
				}
			}
		};
        $log('FD: DEBUG: uploading ' + file.name)
		data.append('upload_attachment', file);
		xhr.open('POST', this.options.upload_attachment_url);
		xhr.setRequestHeader('X-File-Name', file.name);
		xhr.setRequestHeader('X-File-Size', file.fileSize)
		xhr.setRequestHeader("X-CSRFToken", Cookie.read('csrftoken'));
        xhr.send(data);
    },

    addExternalAttachment: function(url, filename) {
        // download content and create new attachment
        $log('FD: DEBUGB downloading ' + filename + ' from ' + url);
        this.addNewAttachment(
            this.options.add_attachment_url,
            {url: url, filename: filename});
    },
	
	addAttachment: function(filename) {
        // add empty attachment
        this.addNewAttachment(
            this.options.add_attachment_url,
            {filename: filename});
	},

    addNewAttachment: function(url, data) {
		var that = this;
		new Request.JSON({
			url: url,
			data: data,
            useSpinner: true,
            spinnerTarget: 'attachments',
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				that.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				that.attachments[response.uid] = new Attachment(that, {
					append: true,
					active: true,
					filename: response.filename,
					ext: response.ext,
					author: response.author,
					code: response.code,
					get_url: response.get_url,
					uid: response.uid,
					type: response.ext
				});
			}
		}).send();
    },

	renameAttachment: function(uid, newName, quiet) {
		var that = this,
            att = this.attachments[uid],
			filename = newName;
		
		// break off an extension from the filename
		var ext = filename.getFileExtension() || '';
		if (ext) {
			filename = filename.getFileName();
		}
		
		var attachmentEl = fd.sidebar.getBranchFromFile(newName, 'data');
		var spinnerEl = attachmentEl || $(fd.sidebar.trees.data);
		
		new Request.JSON({
			url: that.options.rename_attachment_url,
            useSpinner: true,
            spinnerTarget: spinnerEl,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			data: {
				uid: uid,
				new_filename: filename,
				new_ext: ext
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				that.registerRevision(response);
                if (!quiet) {
                    fd.message.alert(response.message_title, response.message);
                }
				
				var attachment = that.attachments[uid];
                if (!attachment) {
					$log("WARN: Attachment (" + uid + ") couldn't be found in fd.item");
					return;
				}
				attachment.reassign({
					append: !attachmentEl,
					active: false,
					filename: response.filename,
					ext: response.ext,
					author: response.author,
					code: response.code,
					get_url: response.get_url,
					uid: response.uid,
					type: response.ext
				});
                
			}
		}).send();
	},

	removeAttachment: function(attachment) {
		var self = this;
		new Request.JSON({
			url: self.options.remove_attachment_url,
            useSpinner: true,
            spinnerTarget: fd.sidebar.getBranchFromFile(attachment),
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			data: {uid: attachment.options.uid},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				self.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				delete self.attachments[attachment.options.uid];
				attachment.destroy();
			}
		}).send();
	},
	
	addModule: function(filename) {
		new Request.JSON({
			url: this.options.add_module_url,
            useSpinner: true,
            spinnerTarget: 'modules',
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			data: {'filename': filename},
			onSuccess: function(response) {
				// set the redirect data to view_url of the new revision
				fd.setURIRedirect(response.view_url);
				// set data changed by save
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				// initiate new Module
				var mod = new Module(this,{
					append: true,
					active: true,
					filename: response.filename,
					author: response.author,
					code: response.code,
					get_url: response.get_url
				});
				this.modules[response.filename] = mod;
			}.bind(this)
		}).send();
	},

	renameModule: function(oldName, newName) {
		newName = newName.replace(/\..*$/, '');
        var el = fd.sidebar.getBranchFromPath(newName+'.js', 'lib');
		new Request.JSON({
			url: this.options.rename_module_url,
            useSpinner: true,
            spinnerTarget: el,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			data: {
				old_filename: oldName,
				new_filename: newName
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				
				var mod = this.modules[oldName];
				var modId = mod.getID();
				mod.setOptions({
					filename: response.filename,
					get_url: response.get_url
				});
				this.modules[response.filename] = mod;
				// change the id of the element
				$(modId).set('id', mod.getID());
				delete this.modules[oldName];
			}.bind(this)
		}).send();
	},

	removeModule: function(module) {
        var el = fd.sidebar.getBranchFromFile(module);
		new Request.JSON({
			url: this.options.remove_module_url,
            useSpinner: true,
            spinnerTarget: el,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			data: module.options,
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				module.destroy();
			}.bind(this)
		}).send();
	},
	
	removeAttachments: function(path) {
        var el = fd.sidebar.getBranchFromPath(path, 'data');
		new Request.JSON({
			url: this.options.remove_folder_url,
			data: {
				name: path,
				root_dir: 'data'
			},
            useSpinner: true,
            spinnerTarget: el,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				response.removed_attachments.forEach(function(uid) {
				    this.attachments[uid].destroy();
				}, this);
				response.removed_dirs.forEach(function(name) {
				    fd.sidebar.removeFile(name, 'd')
				}, this);
                fd.sidebar.removeFile(response.foldername, 'd')
			}.bind(this)
		}).send();
	},

	removeModules: function(path) {
        var el = fd.sidebar.getBranchFromPath(path, 'lib');
	    new Request.JSON({
			url: this.options.remove_module_url,
			data: {filename: path+'/'},
            useSpinner: true,
            spinnerTarget: el,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				response.removed_modules.forEach(function(filename) {
				    this.modules[filename].destroy();
				}, this);
				response.removed_dirs.forEach(function(name) {
				    fd.sidebar.removeFile(name, 'l')
				}, this);
				
			}.bind(this)
		}).send();
	},
	
	addFolder: function(name, root_dir) {
		var el = root_dir == Folder.ROOT_DIR_LIB ?
            'modules' : 'attachments';
        new Request.JSON({
			url: this.options.add_folder_url,
			data: {
				name: name,
				root_dir: root_dir
			},
            useSpinner: true,
            spinnerTarget: el,
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				this.folders[root_dir + '/' + response.name] = new Folder(this, {
					append: true,
					name: response.name,
					root_dir: root_dir
				});
			}.bind(this)
		}).send();
	},
	
	removeFolder: function(folder) {
		new Request.JSON({
			url: this.options.remove_folder_url,
			data: {
				name: folder.options.name,
				root_dir: folder.options.root_dir
			},
            useSpinner: true,
            spinnerTarget: fd.sidebar.getBranchFromFile(folder),
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				folder.destroy();
			}.bind(this)
		}).send();
	},

	assignLibrary: function(library_id) {
		if (library_id) {
			new Request.JSON({
				url: this.options.assign_library_url,
				data: {'id_number': library_id},
                useSpinner: true,
                spinnerTarget: 'plugins',
				spinnerOptions: {
					img: {
						'class': 'spinner-img spinner-16'
					}
				},
				onSuccess: function(response) {
					// set the redirect data to view_url of the new revision
					fd.setURIRedirect(response.view_url);
					// set data changed by save
					this.registerRevision(response);
					fd.message.alert(response.message_title, response.message);
					this.libraries[response.library_id_number] = new Library(this, {
						full_name: response.library_full_name,
						id_number: response.library_id_number,
						library_name: response.library_name,
						view_url: response.library_url,
						revision_number: response.library_revision_number
					});
				}.bind(this)
			}).send();
		} else {
			fd.error.alert('No such Library', 'Please choose a library from the list');
		}
	},
	
	updateLibrary: function(lib, callback) {
		new Request.JSON({
			url: this.options.update_library_url,
			data: {
				'id_number': lib.options.id_number,
				'revision': lib.retrieveNewVersion().revision
			},
			useSpinner: true,
			spinnerTarget: 'libraries',
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				lib.setOptions({
					view_url: response.library_url
				});
				Function.from(callback)(response);
			}.bind(this)
		}).send();
	},

    checkDependenciesVersions: function() {
        var that = this;
        new Request.JSON({
            method: 'get',
			url: that.options.latest_dependencies_url,
			timeout: 5000,
            onSuccess: function(res) {
                res.forEach(function(latest_revision) {
                    var lib = that.libraries[latest_revision.id_number];
					if (!lib) return;
					lib.storeNewVersion(latest_revision);
					fd.sidebar.setPluginUpdate(lib);
                });
            }
        }).send();
    },
	
	prepareDependenciesInterval: function() {
		var that = this;
		function setCheckInterval() {
			unsetCheckInterval();
			that.checkDependenciesVersions();
			that.checkDependenciesInterval = that.checkDependenciesVersions.periodical(60000, that);
		}
		
		function unsetCheckInterval() {
			clearInterval(that.checkDependenciesInterval);
		}
		
		window.addEvent('focus', setCheckInterval);
		window.addEvent('blur', unsetCheckInterval);
		setCheckInterval();
		
	},
    
	removeLibrary: function(lib) {
		new Request.JSON({
			url: this.options.remove_library_url,
			data: {'id_number': lib.options.id_number},
            useSpinner: true,
            spinnerTarget: fd.sidebar.getBranchFromFile(lib),
			spinnerOptions: {
				img: {
					'class': 'spinner-img spinner-16'
				}
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				lib.destroy();
			}.bind(this)
		}).send();
	},

	/*
	 * Method: makePublic
	 * activate a package
	 */
	makePublic: function(e) {
		e.stop();
		this.savenow = false;
		var activateButton = $('UI_ActivateLink');
		if (activateButton.getElement('a').hasClass('inactive')) return false;
		new Request.JSON({
			url: activateButton.getElement('a').get('href'),
			useSpinner: true,
			spinnerTarget: activateButton,
			spinnerOptions: {
				img: {
					class: 'spinner-img spinner-16'
				},
				maskBorder: false
			},
			onSuccess: function(response) {
				fd.message.alert(response.message_title, response.message);
				fd.fireEvent('activate_' + response.package_type);
				activateButton.addClass('pressed').getElement('a').addClass('inactive');
				$('UI_DisableLink').removeClass('pressed').getElement('a').removeClass('inactive');
			}
		}).send();
	},

	/*
	 * Method: makePrivate
	 * deactivate a package
	 */
	makePrivate: function(e) {
		e.stop();
		this.savenow = false;
		var deactivateButton = $('UI_DisableLink');
		if (deactivateButton.getElement('a').hasClass('inactive')) return false;
		new Request.JSON({
			url: deactivateButton.getElement('a').get('href'),
			useSpinner: true,
			spinnerTarget: deactivateButton,
			spinnerOptions: {
				img: {
					class: 'spinner-img spinner-16'
				},
				maskBorder: false
			},
			onSuccess: function(response) {
				fd.message.alert(response.message_title, response.message);
				fd.fireEvent('disable_' + response.package_type);
				$('activate').addEvent('click', this.makePublic.bind(this));
				deactivateButton.addClass('pressed').getElement('a').addClass('inactive');
				$('UI_ActivateLink').removeClass('pressed').getElement('a').removeClass('inactive');
			}.bind(this)
		}).send();
	},

	/*
	 * Method: editInfo
	 * display the EditInfoModalWindow
	 */
	editInfo: function(e) {
		e.stop();
		this.savenow = false;
		fd.editPackageInfoModal = fd.displayModal(
				settings.edit_package_info_template.substitute(
					Object.merge({}, this.data, this.options)));
		$('package-info_form').addEvent('submit', this.boundSubmitInfo);
		$('full_name').addEvent('change', function() { 
			fd.fireEvent('change'); 
		});
		$('package_description').addEvent('change', function() { 
			fd.fireEvent('change'); 
		});
		if ($('savenow')) {
			$('savenow').addEvent('click', function() {
				this.savenow = true;
			}.bind(this));
		}

		$('UI_ActivateLink').getElement('a').addEvent('click', this.makePublic.bind(this));
		$('UI_DisableLink').getElement('a').addEvent('click', this.makePrivate.bind(this));

		this.validator = new Form.Validator.Inline('package-info_form');
		self = this;
		$$('#package-info_form input[type=submit]').each(function(el) {
			el.addEvent('click', function(e) {
				if (!self.validator.validate()) {
					e.stop();
				}
			});
		});
		// Update modal from data (if not saved yet)
		Object.each(this.data, function(value, key) {
			if ($(key)) {
                $log(key + ': ' + value);
				$(key).value = value;
			}
		})
	},

	/*
	 * Method: submitInfo
	 * submit info from EditInfoModalWindow
	 * if $('savenow') clicked - save the full info
	 */
	submitInfo: function(e) {
		e.stop();
		// collect data from the Modal
		this.options.package_info_form_elements.each(function(key) {
			if ($(key)) {
				this.data[key] = $(key).value;
			}
		}, this);
		// check if save should be called
		if (this.savenow) {
			return this.save();
		}
		fd.editPackageInfoModal.destroy();
	},

	collectData: function() {
		this.editor.dumpCurrent();
        this.data.version_name = $('version_name').get('value');
        this.data.revision_message = $('revision_message').get('value');
		Object.each(this.modules, function(module, filename) {
            var mod = this.editor.items[module.uid];
            if (mod.content && mod.changed) {
    			this.data[filename] = mod.content;
            }
		}, this);
		Object.each(this.attachments, function(attachment, uid) {
            var att = this.editor.items[uid 
                        + attachment.options.code_editor_suffix];
            if (att.content && att.changed) {
    			this.data[attachment.options.uid] = att.content;
            }
		}, this);
	},

	testAddon: function(e){
		this.collectData();
		this.data.live_data_testing = true;
		this.parent(e);
	},

	saveAction: function(e) {
		if (e) e.stop();
		this.save();
	},

	save: function() {
		this.collectData();
		this.saving = true;
		new Request.JSON({
			url: this.options.save_url,
			data: this.data,
            useSpinner: true,
            spinnerTarget: $(this.options.save_el),
            spinnerOptions: {
                img: {
                    'class': 'spinner-img spinner-16'
                },
                maskBorder: false
            },
			onSuccess: function(response) {
				// set the redirect data to view_url of the new revision
                $log('response success')
				if (response.full_name) {
					$('package-info-name').set('text', response.full_name);
					this.options.full_name = response.full_name;
				}
                $('revision_message').set('value', '');
                if (response.attachments_changed) {
                    Object.forEach(response.attachments_changed, 
                        function(options, uid) {
                            $log(this.attachments[uid]);
                            if (this.attachments[uid]) {
                                // updating attachment's uid
                                var att = this.attachments[uid];
                                att.reassign(options);
                            }
                        }, this
                    );
                }
				fd.setURIRedirect(response.view_url);
				// set data changed by save
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				// clean data leaving package_info data
				this.data = {};
				this.options.package_info_form_elements.each(function(key) {
					if (response[key] != null) {
						this.data[key] = response[key]
					}
				}, this);
				if (fd.editPackageInfoModal) fd.editPackageInfoModal.destroy();
				if ($(this.options.test_el) && $(this.options.test_el).hasClass('pressed')) {
					// only one add-on of the same id should be allowed on the Helper side
					this.installAddon();
				}
                this.editor.cleanChangeState();
				fd.fireEvent('save');
			}.bind(this),
			addOnFailure: function() {
				this.saving = false;
			}.bind(this)
		}).send();
	},

    blur: function() {
        this._focused = false;
		this.editor.blur();
        this.fireEvent('blur');
		this.editor.addEvent('focus:once', function() {
			if (!this._focused) {
				this.focus();
			}
		}.bind(this));
    },
	
	_focused: true,

    focus: function() {
        if (this._focused) return;
		this._focused = true;
		this.keyboard.activate();
		this.editor.focus();
		
        this.fireEvent('focus');
    },

	bind_keyboard: function() {
	    var that = this;
        this.keyboard = new FlightDeck.Keyboard();
		if(this.options.type == 'a') {
			this.keyboard.addShortcut('test', {
                keys:'ctrl+enter',
				description: 'Toggle Testing',
				handler: function(e) {
                    e.preventDefault();
                    that.testAddon();
                }
			});
		}
		this.keyboard.addShortcuts({
			'save': {
				keys:'ctrl+s',
				description: 'Save current outstanding changes.',
				handler: this.boundSaveAction
			},
			
			'new attachment': {
                keys: 'ctrl+n',
				description: 'Open the New Attachment prompt.',
				handler: function(e) {
                    e.preventDefault();
                    fd.sidebar.promptAttachment();
                }
			},
			'new module': {
                keys:'ctrl+shift+n',
				description: 'Open the New Module prompt.',
				handler: function(e) {
                    e.preventDefault();
                    fd.sidebar.promptNewFile();
                }
			},
			'focus tree / editor': {
                keys: 'ctrl+e',
				description: 'Switch focus between the editor and the tree',
				handler: function(e) {
                    e.preventDefault();
                    if(that._focused) {
						that.blur();
						fd.sidebar.focus();
					} else {
						//fd.sidebar.blur();
						that.focus();
					}
                } 
			},
			'shortcuts': {
				keys: 'ctrl+shift+/',
				description: 'Show these keyboard shortcuts',
				handler: function() {
					that.toggleShortcutsModal();
				}
			}
		})
		this.keyboard.manage(fd.sidebar.keyboard);
		this.keyboard.activate();
		fd.sidebar.keyboard.deactivate();
		this.addEvent('focus', function() {
			fd.sidebar.blur();
		});
	},
	
	toggleShortcutsModal: function() {
		this._shortcutsModal ?
			this.hideShortcuts() :
			this.showShortcuts();
	},
	
	showShortcuts: function() {
		function buildLines(shortcut) {
			var keys = '<kbd>'+ shortcut.keys.split('+').join('</kbd> + <kbd>').split('|').join('</kbd> or <kbd>').replace(/meta/g, 'cmd') + '</kbd>';
			shortcuts.push(keys + ': ' + shortcut.description);
		}
		
		var shortcuts = [];
		
		shortcuts.push('<strong>Editor</strong>');
		this.keyboard.getShortcuts().forEach(buildLines);
		shortcuts.push('<strong>Tree</strong>');
		fd.sidebar.keyboard.getShortcuts().forEach(buildLines);
		
		this._shortcutsModal = fd.displayModal('<h3>Keyboard Shortcuts</h3>'
						+'<div class="UI_Modal_Section"><p>'
						+shortcuts.join('</p><p>')
						+'</p></div>'
		);
		this._shortcutsModal.addEvent('destroy', function() {
			this._shortcutsModal = null
		}.bind(this));
	},
	
	hideShortcuts: function() {
		if (this._shortcutsModal) {
			this._shortcutsModal.destroy();
		}
	},

	registerRevision: function(urls) {
        // update page title to reflect current revision and name
        document.title = document.title.replace(this.options.revision_string, urls.revision_string);
        this.setOptions(urls);
        // this only for the right display href
        if (urls.download_url && $(this.options.download_el)) {
            $(this.options.download_el).set('href', urls.download_url);
        }
	}
	
});
