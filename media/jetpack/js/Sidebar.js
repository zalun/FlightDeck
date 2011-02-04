
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
		
		this.resizeTreeContainer();
		window.addEvent('resize', this.resizeTreeContainer.bind(this));
	},
	
	resizeTreeContainer: function() {
		// set height on tree container, to allow for overflow:auto
		var container = this.element.getElement('.trees-container');
		if(container) {
			container.setStyle('height', window.getHeight() - container.getTop());
		}
	},
	
	buildTree: function() {
		var that = this;
		var treeOptions = {
			checkDrag: function(el){
				return !el.hasClass('nodrag') && that.options.editable && !el.getElement('> .holder > .label[contenteditable="true"]');
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
				that.renameFile(this.current.retrieve('file'), this.getFullPath(this.current));
			}
		};
		
		// Tree and Collapse initilizations
		var trees = this.trees = {};
		var topBranchOptions = {
			add: this.options.editable,
			edit: false,
			remove: false,
			collapsed: false
		};
		
		var addon_or_lib_url = window.location.pathname.match(/\/[a-z]+\/\d+\//g)[0]
				.replace(/\//g, '_');
		
		var collapseOptions = {
			getAttribute: function(element) {
				return element.get('path') || element.get('id');
			},
			getIdentifier: function(element) {
				return addon_or_lib_url + '_collapse_' + element.get('id')
			}
		};
		
		if($('LibTree')) {
			trees.lib = new FileTree('LibTree', treeOptions);
			trees.lib.collapse = new FileTree.Collapse('LibTree', collapseOptions);
			trees.lib.addBranch({
				'rel': 'directory',
				'title': 'Lib',
				'id': 'lib_branch',
				'class': 'top_branch nodrag'
			}, null, topBranchOptions);
			trees.lib.collapse.prepare();
		}
		
		if($('DataTree')) {
			trees.data = new FileTree('DataTree', treeOptions);
			trees.data.collapse = new FileTree.Collapse('DataTree', collapseOptions);
			trees.data.addBranch({
				'rel': 'directory',
				'title': 'Data',
				'id': 'data_branch',
				'class': 'top_branch nodrag'
			}, null, topBranchOptions);
			trees.data.collapse.prepare();
		}
			
		if($('PluginsTree')) {	
			trees.plugins = new FileTree('PluginsTree', Object.merge({}, treeOptions, { actions: {
				edit: false,
				remove: true
			}}));
			trees.plugins.collapse = new FileTree.Collapse('PluginsTree', collapseOptions);
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
			trees.plugins.collapse.prepare();
		}

		this.attach();
		
		return this;
	},
	
	attach: function() {
		var that = this,
			sidebarEl = $(this);
			
		// highlight branch on click
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .label:not([contenteditable="true"]))'.substitute(this.options), function(e) {
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
		if(this.trees.lib) {
			$(this.trees.lib).addEvent('click:relay(.add)', function(e) {
				that.promptNewFile(e.target.getParent('li'));
			});
		}
		
		//adding attachments to Data
		if(this.trees.data) {
			$(this.trees.data).addEvent('click:relay(.add)', function(e) {
				that.promptAttachment(e.target.getParent('li'));
			});
		}
		
		//adding User Libraries to Plugins
		if(this.trees.plugins) {
			$(this.trees.plugins).addEvent('click:relay(li.top_branch > .holder .add)', function(e) {
				that.promptPlugin();
			});
		}
		
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
			el;
			
		el = this.getBranchFromFile(file);
		el.dispose();
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
	
		if (!this.options.editable || file.options.main) {
			options.edit = false;
			options.remove = false;
			options.nodrag = true;
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
	
	getBranchFromFile: function(file) {
		var branch,
			tree;
		
		if(file instanceof Library) {
			title = file.options.full_name;
			tree = this.trees.plugins;
		} else {
			title = file.options.filename + '.' + file.options.type;
			
		}
		
		$(this).getElements('.tree li[path="{title}"]'.substitute({title:title})).some(function(el) {
			if(el.retrieve('file') == file) {
				branch = el;
				return true;
			}
		});
		
		return branch;
	},
	
	setSelectedFile: function(el) {
		var options = this.options;
		
		if (el instanceof File) el = this.getBranchFromFile(el);
		
		$(this).getElements('.'+options.file_listing_class+' li')
			.removeClass(options.file_selected_class)
			.addClass(options.file_normal_class);
		
		el.removeClass(options.file_normal_class)
			.addClass(options.file_selected_class);
		
		//also be sure to expand all parent folders
		var tree = new Tree(el.getParent('.tree')),
			node = el;
		
		while (node = node.getParent('li')) {
			tree.collapse.expand(node);
		}
		
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
	
	promptNewFile: function(folder) {
		var path = folder.get('path') || '';
		if (path) path += '/';
		
		var prompt = fd.showQuestion({
			title: 'Create a new file or folder',
			message: '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>' +
				'<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>' +
				'<input type="text" name="new_file" id="new_file" placeholder="Enter name..." />',
			ok: 'Create',
			id: 'create_new_file',
			callback: function() {
				// get data
				var filename = path + $('new_file').value,
					pack = fd.getItem();
					
				if (!filename) {
					fd.error.alert('Filename can\'t be empty', 'Please provide the name of the module');
					return;
				}
				
				if (filename[filename.length-1] == '/') {
					isFolder = true;
					filename = filename.substr(0, filename.length-1);
				} else {
					//strip off any .js
					filename = filename.replace(/\.js$/, '');
				}
				
				if (!isFolder && Module.exists(filename)) {
					fd.error.alert('Filename has to be unique', 'You already have the module with that name');
					return;
				} else if (isFolder && Folder.exists(filename, Folder.ROOT_DIR_LIB)) {
					fd.error.alert('Folder has to be unique', 'You already have the folder with that name');
					return;
				}
				
				if (isFolder){
					pack.addFolder(filename, Folder.ROOT_DIR_LIB);
				} else {
					pack.addModule(filename);
				}
				prompt.destroy();
			}
		});

		//hookup File / Folder buttons
		var fileBtn = $('new_type_file'),
			folderBtn = $('new_type_folder'),
			isFolder = false;
			
		fileBtn.addEvent('click', function(e) {
			e.stop();
			folderBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = false;
		});
		
		folderBtn.addEvent('click', function(e) {
			e.stop();
			fileBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = true;
		});
	},
	
	promptAttachment: function() {
		var prompt = fd.showQuestion({
			title: 'Create or Upload an Attachment',
			message: '<input type="file" name="upload_attachment" id="upload_attachment"/>'
				+ '</p><p style="text-align:center">&mdash; OR &mdash;</p><p>'
				+ '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>'
				+ '<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>'
				+ '<input type="text" name="new_attachment" id="new_attachment" placeholder="New Attachment name..." />',
			ok: 'Create Attachment',
			id: 'new_attachment_button',
			focus: false, //dont auto focus since first option is to Upload
			callback: function() {
				var uploadInput = $('upload_attachment'),
					createInput = $('new_attachment'),
					files = uploadInput.files,
					pack = fd.getItem();
				
				//validation
				if(!(files && files.length) && !createInput.value) {
					fd.error.alert('No file was selected.', 'Please select a file to upload.');
					return;
				}
				
				for (var f = 0; f < files.length; f++){
					var filename = files[f].fileName.replace(/\.[^\.]+$/g, ''),
						ext = files[f].fileName.match(/\.([^\.]+)$/)[1];
						
					if (Attachment.exists(filename, ext)) {
						fd.error.alert('Filename has to be unique', 'You already have an attachment with that name.');
						return;
					}
				}
				
				
				if(files.length) {
					pack.sendMultipleFiles(uploadInput.files);
				} else if (isFolder) {
					pack.addFolder(createInput.value, Folder.ROOT_DIR_DATA);
				} else {
					pack.addAttachment(createInput.value);
				}
				
				prompt.destroy();
			}
		});
		
		//hookup File / Folder buttons
		var fileBtn = $('new_type_file'),
			folderBtn = $('new_type_folder'),
			isFolder = false;
			
		fileBtn.addEvent('click', function(e) {
			e.stop();
			folderBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = false;
		});
		
		folderBtn.addEvent('click', function(e) {
			e.stop();
			fileBtn.removeClass('selected');
			this.addClass('selected');
			isFolder = true;
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