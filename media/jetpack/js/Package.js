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
        check_if_latest: true  // switch to false if displaying revisions
	},

	modules: {},

	attachments: {},

	plugins: {},
	
	folders: {},

	initialize: function(options) {
		this.setOptions(options);
        // create empty editor
        this.editor = new FDEditor('editor-wrapper');
        // initiate the sidebar 
		fd.sidebar.options.editable = !this.options.readonly;
		fd.sidebar.buildTree();
		this.instantiate_modules();
		this.instantiate_attachments();
		this.instantiate_folders();
		this.instantiate_dependencies();
		// hook event to menu items
		$('revisions_list').addEvent('click', this.show_revision_list);
		if (this.isAddon()) {
            this.boundTestAddon = this.testAddon.bind(this);
			this.options.test_url = $(this.options.test_el).get('href');
			$(this.options.test_el).addEvent('click', this.boundTestAddon)
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
	},

	/*
	 * Method: checkIfLatest
	 * check if currently displayed revision is the latest one
	 * call fail_callback if not
	 */ 
	checkIfLatest: function(failCallback) {
		// ask backend for the latest revision number
		new Request.JSON({
			url: this.options.check_latest_url,
			onSuccess: function(response) {
				if (failCallback && this.options.revision_number != response.revision_number) {
					failCallback.call()
				}
			}.bind(this)
		}).send();
	},

	askForReload: function() {
		fd.warning.alert("New revision detected", 
				"There is a newer revision available. You may wish to reload the page.");
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
		new Request.JSON({
			url: this.options.copy_url,
			onSuccess: function(response) {
				window.location.href = response.view_url;
			}
		}).send();
	},

	downloadAddon: function(e){
		if (e) {
		  e.stop();
		  el = e.target;
		} else {
		  el = $(this.options.download_el);
		}
		fd.tests[this.options.hashtag] = {
			spinner: new Spinner(el.getParent('div')).show()
		};
		data = {
			hashtag: this.options.hashtag, 
			filename: this.options.name
		};
		new Request.JSON({
		  url: this.download_url,
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
				fd.uninstallXPI(el.get('rel'));
			} else {
				this.installAddon();
			}
		} else {
			fd.whenAddonInstalled(function() {
				fd.message.alert(
					'Add-on Builder Helper',
					'Now that you have installed the Add-ons Builder Helper, loading the add-on into your browser for testing...'
				);
				this.testAddon();
			}.bind(this));
		}
	},

	installAddon: function() {
		fd.tests[this.options.hashtag] = {
			spinner: new Spinner(
                             $(this.options.test_el).getParent('div')).show()
		};
		var data = this.data || {};
		data['hashtag'] = this.options.hashtag;
		new Request.JSON({
            url: this.options.test_url,
            data: data,
            onSuccess: fd.testXPI
		}).send();
	},

	isAddon: function() {
		return (this.options.type == 'a');
	},

	instantiate_modules: function() {
		// iterate by modules and instantiate Module
        // XXX: this is quite hacky - it should be determnined in the
        //      back-end
		var main_module;
		this.options.modules.each(function(module) {
			module.readonly = this.options.readonly;
			module.append = true;
			if (!main_module && module.filename == 'main') {
				module.main = true;
				main_module = module;
			}
			this.modules[module.filename] = new Module(this,module);
		}, this);
		
		//if no main, then activate the first module
		if (!main_module){
			if (this.options.modules[0]) {
				var mod = this.modules[this.options.modules[0].filename];
				fd.sidebar.setSelectedFile(mod)
				this.editor.switchTo(mod);
			} else {
				// XXX: <--- add module first
			}
		}
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
			this.plugins[plugin.full_name] = new Library(this,plugin);
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
		new Request({
			url: settings.revisions_list_html_url,
			onSuccess: function(html) {
				fd.displayModal(html);
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
			Object.each(fd.getItem().modules, function(mod) {
				if (!first) {
					first = true;
					mod.switchTo();
					fd.sidebar.setSelectedFile(mod);
				}
			});
			if (!first) {
				fd.item.editor.setContent('');
			}
		}
		this.fireEvent('destroy');
	},

	switchTo: function() {
		fd.item.editor.switchTo(this);
	}
});

var Library = new Class({
	
	Extends: File,
	
	options: {
		append: true
	},
	
	initialize: function(pack, options) {
		options.path = options.full_name;
		this.parent(pack, options);
		
		if(!this.options.id_number) {
			// hacky... maybe we should just always pass this with
			// the new Package.Edit() data on page load?
			this.options.id_number = this.options.view_url.split('/')[2];
		}
		
		this.addEvent('destroy', function(){
			delete fd.getItem().plugins[this.options.full_name];
		})
		
		if(this.options.append) {
			this.append();
		}
	},
	
	append: function() {
		fd.sidebar.addPlugin(this);
	},
	
	onSelect: function() {
		//open in a new tab, of course
		window.open(this.options.view_url);
	},
	
	getID: function() {
		return 'Library-' + this.options.name;
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
        this.uid = this.options.uid + this.options.code_editor_suffix;

		if (this.options.append) {
			this.append();
		}
		this.addEvent('destroy', function(){
			delete pack.attachments[this.options.uid];
		});
		// create editor
		if (this.options.active && this.is_editable()) {
			pack.editor.switchTo(this);
		} else {
            pack.editor.registerItem(this);
        }
	},

	onSelect: function() {
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
                template_middle += '<p><img src="'+this.options.get_url
                    +'"/></p>';
            }
			this.attachmentWindow = fd.displayModal(template_start+template_middle+template_end);
		}
	},

	loadContent: function() {
		// load data synchronously
		new Request({
			url: this.options.get_url,
			async: false,
			useSpinner: true,
			spinnerTarget: 'editor-wrapper',
			onSuccess: function(text) {
                this.content = text;
                this.original_content = text;
				this.fireEvent('loadcontent', text);
			}.bind(this)
		}).send();
	},

	getID: function() {
		return 'Attachment-'+this.uid;
	},

	append: function() {
		fd.sidebar.addData(this);
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
			delete fd.getItem().modules[this.options.filename];
		});
		
		if (this.options.append) {
			this.append();
		}
        // an uid for the editor
        this.uid = this.options.filename + this.options.suffix;
		// create editor
        if (this.options.main || this.options.active) {
            pack.editor.switchTo(this);
        } else {
            pack.editor.registerItem(this);
        }
	},

	onSelect: function() {
		this.switchTo();
	},

	append: function() {
		fd.sidebar.addLib(this);
    },
	
	loadContent: function() {
		// load data synchronously
		new Request.JSON({
            url: this.options.get_url,
            async: false,
            useSpinner: true,
            spinnerTarget: 'editor-wrapper',
            onSuccess: function(mod) {
                this.original_content = mod.code;
                this.content = mod.code;
                this.fireEvent('loadcontent', mod.code);
            }.bind(this)
		}).send();
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
		root_dir: 'l'
	},
	
	initialize: function(pack, options) {
		this.parent(pack, options);
		this.options.path = this.options.name;
		
		this.addEvent('destroy', function(){
			delete fd.getItem().folders[this.options.root_dir + '/' +this.options.name];
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
		$log('selected a Folder');
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
		$(this.options.package_info_el).addEvent('click', this.showInfo.bind(this));
	},

	/*
	 * Method: showInfo
		 display a window with info about current Package
	 */

	showInfo: function(e) {
		e.stop();
		fd.displayModal(this.options.package_info);
	},
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
		package_info_form_elements: [
			'full_name', 'version_name', 'package_description', 'revision_message'
			]
	},

	initialize: function(options) {
		this.setOptions(options);
        this.data = {};
		this.parent(options);
		this.assignActions();
		// autocomplete
		//this.autocomplete = new FlightDeck.Autocomplete({
		//	'url': settings.library_autocomplete_url
		//});
	},

	assignActions: function() {
		// assign menu items
		this.appSidebarValidator = new Form.Validator.Inline('app-sidebar-form');
		$(this.options.package_info_el).addEvent('click', this.editInfo.bind(this));

		// save
		this.boundSaveAction = this.saveAction.bind(this);
		$(this.options.save_el).addEvent('click', this.boundSaveAction);

		// submit Info
		this.boundSubmitInfo = this.submitInfo.bind(this);

		if ($('jetpack_core_sdk_version')) {
			$('jetpack_core_sdk_version').addEvent('change', function() {
				new Request.JSON({
					url: this.options.switch_sdk_url,
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

	sendMultipleFiles: function(files) {
		var self = this;
		self.spinner = false;
		sendMultipleFiles({
			url: Function.from(this.options.add_attachment_url),

			// list of files to upload
			files: files,

			// clear the container
			onloadstart:function(){
				if (self.spinner) {
					self.spinner.position();
				} else {
					self.spinner = new Spinner($('attachments')).show();
				}
			},

			// do something during upload ...
			//onprogress:function(rpe){
			//	$log('progress');
			//},

			onpartialload: function(rpe, xhr) {
				$log('FD: attachment uploaded');
				response = JSON.parse(xhr.responseText);
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
			},

			// fired when last file has been uploaded
			onload:function(rpe, xhr){
				if (self.spinner) self.spinner.destroy();
				$log('FD: all files uploaded');
				//$(self.add_attachment_el).set('value','');
				//$('add_attachment_fake').set('value','')
			},

			// if something is wrong ... (from native instance or because of size)
			onerror:function(){
				if (self.spinner) self.spinner.destroy();
				fd.error.alert(
					'Error {status}'.substitute(xhr),
					'{statusText}<br/>{responseText}'.substitute(xhr)
                );
			}
		});
	},
	
	addAttachment: function(filename) {
		var that = this;
		new Request.JSON({
			url: this.options.add_attachment_url,
			data: {filename: filename},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				that.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				self.attachments[response.uid] = new Attachment(that, {
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

	renameAttachment: function(uid, newName) {
		var that = this;
		new Request.JSON({
			url: that.options.rename_attachment_url,
			data: {
				uid: uid,
				new_filename: newName
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				that.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				var attachment = that.attachments[uid];
				attachment.setOptions({
					filename: response.filename
				});
			}
		}).send();
	},

	removeAttachment: function(attachment) {
		var self = this;
		new Request.JSON({
			url: self.options.remove_attachment_url,
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
	
	removeAttachments: function(pathname) {
	    new Request.JSON({
			url: this.options.remove_attachment_url,
			data: {filename: path+'/'},
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
				
			}.bind(this)
		}).send();
	},

	addModule: function(filename) {
		new Request.JSON({
			url: this.options.add_module_url,
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
		new Request.JSON({
			url: this.options.rename_module_url,
			data: {
				old_filename: oldName,
				new_filename: newName
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				
				var mod = this.modules[oldName];
				mod.setOptions({
					filename: response.filename,
					get_url: response.get_url
				});
				this.modules[response.filename] = mod;
				delete this.modules[oldName];
			}.bind(this)
		}).send();
	},

	removeModule: function(module) {
		new Request.JSON({
			url: this.options.remove_module_url,
			data: module.options,
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				module.destroy();
			}.bind(this)
		}).send();
	},
	
	removeModules: function(path) {
	    new Request.JSON({
			url: this.options.remove_module_url,
			data: {filename: path+'/'},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				response.removed_modules.forEach(function(filename) {
				    this.modules[filename].destroy();
				}, this);
				
				response.removed_dirs.forEach(function(name) {
				    $log(name)
				    
				    fd.sidebar.removeFile(name, 'l')
				}, this);
				
			}.bind(this)
		}).send();
	},
	
	addFolder: function(name, root_dir) {
		new Request.JSON({
			url: this.options.add_folder_url,
			data: {
				name: name,
				root_dir: root_dir
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
				onSuccess: function(response) {
					// set the redirect data to view_url of the new revision
					fd.setURIRedirect(response.view_url);
					// set data changed by save
					this.registerRevision(response);
					fd.message.alert(response.message_title, response.message);
					this.plugins[response.full_name] = new Library(this, {
						full_name: response.full_name,
						id_number: response.id_number,
						library_name: response.library_name,
						view_url: response.library_url,
						revision_number: response.library_revision_number,
						path: response.path
					});
				}.bind(this)
			}).send();
		} else {
			fd.error.alert('No such Library', 'Please choose a library from the list');
		}
	},

	removeLibrary: function(lib) {
		new Request.JSON({
			url: this.options.remove_library_url,
			data: {'id_number': lib.options.id_number},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				fd.message.alert(response.message_title, response.message);
				lib.destroy();
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
		fd.editPackageInfoModal = fd.displayModal(settings.edit_package_info_template.substitute(this.data || this.options));
		$('package-info_form').addEvent('submit', this.boundSubmitInfo);
		// XXX: this will change after moving the content to other forms
		$('version_name').addEvent('change', function() { fd.fireEvent('change'); });
		$('full_name').addEvent('change', function() { fd.fireEvent('change'); });
		$('package_description').addEvent('change', function() { fd.fireEvent('change'); });
		if ($('savenow')) {
			$('savenow').addEvent('click', function() {
				this.savenow = true;
			}.bind(this));
		}
		this.validator = new Form.Validator.Inline('package-info_form');
		self = this;
		$$('#package-info_form input[type=submit]').each(function(el) {
			el.addEvent('click', function(e) {
				if (!self.validator.validate()) {
					e.stop();
				}
			});
		});
		// XXX: hack to get the right data in the form
		Object.each(this.data, function(value, key) {
			if ($(key)) $(key).value = value;
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
			if ($(key)) this.data[key] = $(key).value;
		}, this);
		// check if save should be called
		if (this.savenow) {
			return this.save();
		}
		fd.editPackageInfoModal.destroy();
	},

	collectData: function() {
		this.editor.dumpCurrent();
		Object.each(this.modules, function(module, filename) {
            var content = this.editor.items[module.uid].content;
            if (content) {
    			this.data[filename] = content;
            }
		}, this);
		Object.each(this.attachments, function(attachment) {
            var content = this.editor.items[
                attachment.options.uid + attachment.options.code_editor_suffix]
                .content;
            if (content) {
    			this.data[attachment.options.uid] = content;
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
			url: this.options.save_url || this.options.save_url,
			data: this.data,
			onSuccess: function(response) {
				// set the redirect data to view_url of the new revision
				if (response.reload) {
					 window.location.href = response.view_url;
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
				if ($(this.options.test_el) && $(this.options.test_el).getParent('li').hasClass('pressed')) {
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

	bind_keyboard: function() {
		this.keyboard = new Keyboard({
			events: {
				'ctrl+s': this.boundSaveAction
			}
		});
		this.keyboard.activate();
	},

	registerRevision: function(urls) {
        this.setOptions(urls);
		//this.options.revision_number = urls.revision_number;
		//this.options.save_url = urls.save_url;
		//this.options.test_url = urls.test_url;
		//this.options.add_module_url = urls.add_module_url;
		//this.options.rename_module_url = urls.rename_module_url;
		//this.options.remove_module_url = urls.remove_module_url;
		//this.options.add_attachment_url = urls.add_attachment_url;
		//this.options.rename_attachment_url = urls.rename_attachment_url;
		//this.options.remove_attachment_url = urls.remove_attachment_url;
		//this.options.assign_library_url = urls.assign_library_url;
		//this.options.remove_library_url = urls.remove_library_url;
	}
});
