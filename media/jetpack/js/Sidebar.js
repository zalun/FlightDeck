
var Sidebar = new Class({
	
	Implements: [Options, Events],
	
	options: {
		file_selected_class: 'UI_File_Selected',
		file_normal_class: 'UI_File_Normal',
		file_listing_class: 'tree',
		editable: false
	},
	
	trees: {},
	
	initialize: function(options){
		this.setOptions(options);
		this.element = $('app-sidebar');
	},
	
	buildTree: function() {
		var that = this;
		var treeOptions = {
			checkDrag: function(el){
				return !el.hasClass('nodrag') && that.options.editable;
			},
			checkDrop: function(el, drop){
				var isFile = el.get('rel') == 'file',
					isSibling = this.current.getSiblings().contains(el);
					
				return (
						((drop.isSubnode || isSibling) && isFile)
						|| el.hasClass('top_branch')
						|| isSibling && !isFile && !drop.isSubnode
						|| !isFile && drop.isSubnode && this.current.getParent().getParent() == el
					) ? false : true;
			},
			onChange: function(){
				this.updatePath(this.current);
				that.renameFile(this.current.retrieve('file'), this.getFullPath(this.current));
			},
			onRenameComplete: function(){
				$$('div.rename_branch').removeClass('active');
			}
		};
		
		// Tree and Collapse initilizations
		var trees = this.trees = {
			'lib': new FileTree('LibTree', treeOptions),
			'data': new FileTree('DataTree', treeOptions),
			'plugins': new FileTree('PluginsTree', Object.merge({}, treeOptions, { actions: {
				edit: false,
				remove: true
			}}))
		};
		
		var topBranchOptions = {
			add: this.options.editable,
			edit: false,
			remove: false
		};
		
		
		trees.lib.collapse = new Collapse('LibTree');
		trees.lib.addBranch({
			'rel': 'directory',
			'title': 'Lib',
			'id': 'lib_branch',
			'class': 'top_branch nodrag'
		}, null, topBranchOptions);
		
		trees.data.collapse = new Collapse('DataTree');
		trees.data.addBranch({
			'rel': 'directory',
			'title': 'Data',
			'id': 'data_branch',
			'class': 'top_branch nodrag'
		}, null, topBranchOptions);
		
		trees.plugins.collapse = new Collapse('PluginsTree');
		var pluginsBranch = trees.plugins.addBranch({
			'rel': 'directory',
			'title': 'Plugins',
			'id': 'plugins_branch',
			'class': 'top_branch nodrag'
		}, null, topBranchOptions);
		
		var sdkBranch = $('core_library_lib');
		if(sdkBranch) {
			pluginsBranch.getElement('ul').grab(sdkBranch);
		}
		
		this.attach();
		
		return this;
	},
	
	attach: function() {
		var that = this,
			sidebarEl = $(this);
			
		// highlight branch on click
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .label)'.substitute(this.options), function(e) {
			var li = $(e.target).getParent('li'),
				file = li.retrieve('file');
			if(file) {
				if(file.is_editable()) {
					that.setSelectedFile(li);
				}
				
				file.onSelect();
			}
		});
		
		//adding modules to Lib
		$(this.trees.lib).addEvent('click:relay(li.top_branch > .holder .add)', function(e) {
			that.promptNewFile();
		});
		
		//adding attachments to Data
		$(this.trees.data).addEvent('click:relay(li.top_branch > .holder .add)', function(e) {
			that.promptAttachment();
		});
		
		//adding User Libraries to Plugins
		$(this.trees.plugins).addEvent('click:relay(li.top_branch > .holder .add)', function(e) {
			that.promptPlugin();
		});
		
		// delete
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .actions .delete)'.substitute(this.options), function(e) {
			var file = $(e.target).getParent('li').retrieve('file');
			if (!file.options.readonly) {
				that.promptRemoval(file);
			}
		});
		
		Object.each(this.trees, function(tree, name) {
			tree.addEvents({
				'renameComplete': function(li, fullpath) {
					that.renameFile(li.retrieve('file'), fullpath);
				},
				'deleteBranch': function(li) {
					
				}
			});
		});
		
		return this;
	},
	
	renameFile: function(file, fullpath) {
		var pack = fd.getItem();
		if (file instanceof Module) {
			pack.renameModule(file.options.filename, fullpath.replace('.'+file.options.type, ''));
		} else if (file instanceof Attachment) {
			pack.renameAttachment(file.options.uid, fullpath.replace('.'+file.options.type, ''));
		}
	},
	
	removeFileFromTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this,
			title;
			
		if(file instanceof Library) {
			title = file.options.full_name;
		} else {
			title = file.options.filename + '.' + file.options.type;
		}
		
		$(tree).getElements('li[title="{title}"]'.substitute({title:title})).some(function(el) {
			if(el.retrieve('file') == file) {
				el.dispose();
				return true;
			}
		});
	},
	
	addFileToTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this;
			
		if (!tree) {
			this.buildTree();
			tree = this.trees[treeName];
		}
		
		var options = {
			target:	$(tree).getElement('.top_branch'),
			url: file.options.url
		};
	
		if (!this.options.editable) {
			options.edit = false;
			options.remove = false;
		}
		
		
		var element = tree.addPath(file, options);	
		tree.collapse.prepare();
		file.addEvent('destroy', function() {
			that.removeFileFromTree(treeName, file);
		});

		if((file.options.active || file.options.main) && file.is_editable()) {
			this.setSelectedFile(element);
		}
	}.protect(),
	
	addLib: function(lib) {
		this.addFileToTree('lib', lib);
	},
	
	addData: function(attachment) {
		this.addFileToTree('data', attachment);
	},
	
	addPlugin: function(plugin) {
		this.addFileToTree('plugins', plugin);
	},
	
	setSelectedFile: function(el) {
		var options = this.options;
		
		$(this).getElements('.{file_listing_class} li'.substitute(options))
			.removeClass(options.file_selected_class)
			.addClass(options.file_normal_class);
		
		el.removeClass(options.file_normal_class)
			.addClass(options.file_selected_class);
		
		
		
		return this;
	},
	
	promptRemoval: function(file) {
		var question = fd.showQuestion({
			title: 'Are you sure you want to remove {name}?'.substitute({ name: file.options.path }),
			message: file instanceof Module ? 'You may always copy it from this revision' : '',
			ok: 'Remove',
			id: 'remove_file_button',
			callback: function() {
				if (file instanceof Module) {
					fd.getItem().removeModule(file);
				} else if (file instanceof Attachment) {
					fd.getItem().removeAttachment(file);
				} else if (file instanceof Library) {
					fd.getItem().removeLibrary(file);
				}
				
				
				question.destroy();
			}
		});
	},
	
	promptNewFile: function() {
		var prompt = fd.showQuestion({
			title: 'Create a new file',
			message: '<input type="text" name="new_file" id="new_file" placeholder="File name..." />',
			ok: 'Create File',
			id: 'create_new_file',
			callback: function() {
				// get data
				var filename = $('new_file').value,
					pack = fd.getItem();
				if (!filename) {
					fd.error.alert('Filename can\'t be empty', 'Please provide the name of the module');
					return;
				}
				if (pack.options.modules.some(function(mod) { return mod.filename == filename; })) {
					fd.error.alert('Filename has to be unique', 'You already have the module with that name');
					return;
				}
				
				pack.addModule(filename);				
				prompt.destroy();
			}
		});
	},
	
	promptAttachment: function() {
		var prompt = fd.showQuestion({
			title: 'Upload an Attachment',
			message: '<input type="file" name="new_attachment" id="new_attachment" placeholder="Browse for file to attach" />',
			ok: 'Create File',
			id: 'new_attachment_button',
			callback: function() {
				var fileInput = $('new_attachment');
				if(!(fileInput.files && fileInput.files.length)) {
					fd.error.alert('No file was selected.', 'Please select a file to upload.');
					return;
				}
				
				fd.getItem().sendMultipleFiles(fileInput.files);
				prompt.destroy();
			}
		});
	},
	
	promptPlugin: function() {
		var prompt = fd.showQuestion({
			title: 'Add a User Library',
			message: '<input type="text" name="new_library" id="new_library" placeholder="Search for libraries to include" />' +
					 '<input type="hidden" name="library_id_number" id="library_id_number" />',
			ok: 'Add Library',
			id: 'new_library_button',
			callback: function() {
				var lib_id = $('library_id_number').value;
				if(!lib_id) {
					fd.error.alert('No User Library selected', 'Please enter the name of an existing User Library');
					return;
				}
				
				fd.getItem().assignLibrary(lib_id)
				prompt.destroy();
			}
		});
		
		//setup Library autocomplete
		// autocomplete
		var autocomplete = new FlightDeck.Autocomplete({
			'url': settings.library_autocomplete_url
		});
	},
	
	toElement: function() {
		return this.element;
	}
	
});