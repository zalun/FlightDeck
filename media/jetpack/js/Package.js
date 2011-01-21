/*
 * File: jetpack.Package.js
 */

/*
 * Javascript Package/PackageRevision representation
 */

var Package = new Class({
	// this Class should be always extended
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
		download_el: 'download'
	},
	modules: {},
	attachments: {},
	plugins: {},
	initialize: function(options) {
		this.setOptions(options);
		this.revision_number = this.options.revision_number;
		fd.sidebar.options.editable = !this.options.readonly;
		this.instantiate_modules();
		this.instantiate_attachments();
		this.instantiate_dependencies();
		
		$('revisions_list').addEvent('click', this.show_revision_list);

		// testing
		this.boundTestAddon = this.testAddon.bind(this);
		if (this.isAddon()) {
			this.test_url = $(this.options.test_el).get('href');
			$(this.options.test_el).addEvent('click', this.boundTestAddon)
		}
		this.copy_el = $(this.options.copy_el)
		if (this.copy_el) {
			this.copy_el.addEvent('click', this.copyPackage.bind(this));
		}
		window.addEvent('focus', function() {
			this.checkIfLatest(this.askForReload.bind(this));
		}.bind(this));
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
				if (failCallback && this.revision_number != response.revision_number) {
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
		var hashtag = this.options.hashtag;
		fd.tests[hashtag] = {
			spinner: new Spinner(el.getParent('div')).show()
		};
		data = {
			hashtag: hashtag, 
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
		var hashtag = this.options.hashtag;
		fd.tests[hashtag] = {
			spinner: new Spinner($(this.options.test_el).getParent('div')).show()
		};
		var data = this.data || {};
		data['hashtag'] = hashtag;
		new Request.JSON({
		  url: this.test_url,
		  data: data,
		  onSuccess: fd.testXPI
		}).send();
	},
	isAddon: function() {
		return (this.options.type == 'a');
	},
	instantiate_modules: function() {
		// iterate by modules and instantiate Module
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
		delete fd.editor_contents[this.get_editor_id()];
		if (this.active) {
			// switch editor!
			mod = null;
			// try to switch to first element
			first = false;
			Object.each(fd.getItem().modules, function(mod) {
				if (!first) {
					first = true;
					mod.switchBespin();
					fd.sidebar.setSelectedFile(mod.trigger.getParent('li'));
				}
			});
			if (!first) {
				fd.cleanBespin();
			}
		}
		this.fireEvent('destroy');
	},
	switchBespin: function() {
		if (!fd.editor_contents[this.get_editor_id()]) {
			this.loadCode();
		}
		fd.switchBespinEditor(this.get_editor_id(), this.options.type);
		if (fd.getItem()) {
			Object.each(fd.getItem().modules, function(mod) {
				mod.active = false;
			});
		}
		this.active = true;
	},
	get_editor_id: function() {
		if (!this._editor_id)
			this._editor_id = this.get_css_id() + this.options.code_editor_suffix;
		return this._editor_id;
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
	
	get_css_id: function() {
		return this.options.full_name;
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

		if (this.options.append) {
			this.append();
		}
		
		this.addEvent('destroy', function(){
			delete fd.getItem().attachments[this.options.uid];
		});

		// create editor
		this.editor = new FDEditor({
			element: this.get_editor_id(),
			activate: this.options.main || this.options.executable,
			type: this.options.type,
			readonly: this.options.readonly
		});
		if (this.options.active && this.is_editable()) {
			this.switchBespin();
			//this.highlightMenu();
		}
	},
	onSelect: function() {
		if (this.is_editable()) {
			this.switchBespin();
		} else {
			var template_start = '<div id="attachment_view"><h3>'+this.options.filename+'</h3><div class="UI_Modal_Section">';
			var template_end = '</div><div class="UI_Modal_Actions"><ul><li><input type="reset" value="Close" class="closeModal"/></li></ul></div></div>';
			var template_middle = 'Download <a href="'+this.options.get_url+'">'+this.options.filename+'</a>';
			if (this.is_image()) template_middle += '<p><img src="'+this.options.get_url+'"/></p>';
			this.attachmentWindow = fd.displayModal(template_start+template_middle+template_end);
		}
	},
	loadCode: function() {
		// load data synchronously
		new Request({
			url: this.options.get_url,
			async: false,
			useSpinner: true,
			spinnerTarget: 'editor-wrapper',
			onSuccess: function(text, html) {
				fd.editor_contents[this.get_editor_id()] = text;
			}.bind(this)
		}).send();
	},
	get_css_id: function() {
		return this.options.uid;
	},
	append: function() {
		fd.sidebar.addData(this);

		if (this.is_editable()) {
			var textarea = new Element('textarea', {
				'id': this.get_editor_id(),
				'class': 'UI_Editor_Area',
				'name': this.get_editor_id(),
				'html': ''
			}).inject('editor-wrapper');
		}
	}
});

var Module = new Class({
	Extends: File,
	options: {
		// data
		// filename: '',
		// code: '',
		// author: '',
		// DOM
		code_trigger_suffix: '_switch', // id of an element which is used to switch editors
		code_editor_suffix: '_textarea', // id of the textarea
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
		// create editor
		this.editor = new FDEditor({
			element: this.get_editor_id(),
			activate: this.options.main || this.options.executable,
			type: this.options.type,
			readonly: this.options.readonly
		});
		
		if (this.options.main || this.options.executable) {
			//fd.sidebar.setSelectedFile(this.trigger.getParent('li'));
		}
		if (this.options.active) {
			this.switchBespin();
		}
	},
	onSelect: function() {
		this.switchBespin();
	},
	loadCode: function() {
		// load data synchronously
		new Request.JSON({
		url: this.options.get_url,
		async: false,
		useSpinner: true,
		spinnerTarget: 'editor-wrapper',
		onSuccess: function(mod) {
			fd.editor_contents[this.get_editor_id()] = mod.code;
		}.bind(this)
		}).send();
	},
	append: function() {
		fd.sidebar.addLib(this);
	
		var textarea = new Element('textarea', {
			'id': this.options.filename + '_textarea',
			'class': 'UI_Editor_Area',
			'name': this.options.filename + '_textarea',
			'html': this.options.code
		}).inject('editor-wrapper');
	},
	get_css_id: function() {
		return this.options.filename;
	}
});

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
		$log(this.options);
		// this.data is a temporary holder of the data for the submit
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
		
		//var fakeFileInput = $('add_attachment_fake'), fakeFileSubmit = $('add_attachment_action_fake');
		//this.add_attachment_el.addEvents({
		//	change: function(){
		//		fakeFileInput.set('value', this.get('value'));
		//	},
		//
		//	mouseover: function(){
		//		fakeFileSubmit.addClass('hover');
		//	},
		//
		//	mouseout: function(){
		//		fakeFileSubmit.removeClass('hover');
		//	}
		//});
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

	get_add_attachment_url: function() {
		return this.add_attachment_url || this.options.add_attachment_url;
	},

	sendMultipleFiles: function(files) {
		var self = this;
		self.spinner = false;
		sendMultipleFiles({
			url: this.get_add_attachment_url.bind(this),

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
	renameAttachment: function(uid, newName) {
		var that = this;
		new Request.JSON({
			url: that.rename_attachment_url || that.options.rename_attachment_url,
			data: {
				uid: uid,
				new_filename: newName
			},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				that.registerRevision(response);
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
			url: self.remove_attachment_url || self.options.remove_attachment_url,
			data: {uid: attachment.options.uid},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				self.registerRevision(response);
				delete self.attachments[attachment.options.uid];
				attachment.destroy();
			}
		}).send();
	},
	addModule: function(filename) {
		new Request.JSON({
			url: this.add_module_url || this.options.add_module_url,
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
			url: this.rename_module_url || this.options.rename_module_url,
			data: {
				old_filename: oldName,
				new_filename: newName
			},
			onSuccess: function(response) {
				$log(response);
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
			url: this.remove_module_url || this.options.remove_module_url,
			data: module.options,
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
				module.destroy();
			}.bind(this)
		}).send();
	},
	assignLibrary: function(library_id) {
		if (library_id) {
			new Request.JSON({
				url: this.assign_library_url || this.options.assign_library_url,
				data: {'id_number': library_id},
				onSuccess: function(response) {
					// set the redirect data to view_url of the new revision
					fd.setURIRedirect(response.view_url);
					// set data changed by save
					this.registerRevision(response);
					//fd.message.alert('Library assigned', response.message);
					this.plugins[response.full_name] = new Library(this, {
						full_name: response.full_name,
						id_number: response.id_number,
						library_name: response.library_name,
						library_url: response.library_url,
						view_url: response.view_url,
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
			url: this.remove_library_url || this.options.remove_library_url,
			data: {'id_number': lib.options.id_number},
			onSuccess: function(response) {
				fd.setURIRedirect(response.view_url);
				this.registerRevision(response);
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
		fd.saveCurrentEditor();
		Object.each(this.modules, function(module, filename) {
			this.data[filename] = fd.editor_contents[filename + module.options.code_editor_suffix]
		}, this);
		Object.each(this.attachments, function(attachment) {
			this.data[attachment.options.uid] = fd.editor_contents[attachment.options.uid + attachment.options.code_editor_suffix]
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
			url: this.save_url || this.options.save_url,
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
				if ($(this.options.test_el).getParent('li').hasClass('pressed')) {
					// only one add-on of the same id should be allowed on the Helper side
					this.installAddon();
				}
				fd.fireEvent('save');
			}.bind(this),
			addOnFailure: function() {
				this.saving = false;
			}.bind(this)
		}).send();
	},
	bind_keyboard: function() {
		this.keyboard = new Keyboard({
			defaultEventType: 'keyup',
			events: {
			'ctrl+s': this.boundSaveAction
			}
		});
		this.keyboard.activate();
	},
	registerRevision: function(urls) {
		this.revision_number = urls.revision_number;
		this.save_url = urls.save_url;
		this.test_url = urls.test_url;
		this.add_module_url = urls.add_module_url;
		this.rename_module_url = urls.rename_module_url;
		this.remove_module_url = urls.remove_module_url;
		this.add_attachment_url = urls.add_attachment_url;
		this.rename_attachment_url = urls.rename_attachment_url;
		this.remove_attachment_url = urls.remove_attachment_url;
		this.assign_library_url = urls.assign_library_url;
		this.remove_library_url = urls.remove_library_url;
	}
});
