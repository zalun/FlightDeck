
var Sidebar = new Class({
	
	Implements: [Options, Events],
	
	options: {
		file_selected_class: 'UI_File_Selected',
		file_normal_class: 'UI_File_Normal',
		file_listing_class: 'tree'
	},
	
	initialize: function(options){
		this.setOptions(options);
		this.element = $('app-sidebar');
		this.buildTree();
		this.attach();
	},
	
	buildTree: function() {
		var treeOptions = {
			checkDrag: function(el){
				return !el.hasClass('nodrag') && this.options.editable;
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
			},
			onRenameComplete: function(){
				$$('div.rename_branch').removeClass('active');
			},
			editable: true
		};
		
		// Tree and Collapse initilizations
		var trees = this.trees = {
			'lib': new Tree('LibTree', treeOptions),
			'data': new Tree('DataTree', treeOptions),
			'plugins': new Tree('PluginsTree', treeOptions)
		};
		
		var topBranchOptions = {
			add: true,
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
		trees.plugins.addBranch({
			'rel': 'directory',
			'title': 'Plugins',
			'id': 'plugins_branch',
			'class': 'top_branch nodrag'
		}, null, topBranchOptions);
		
		return this;
	},
	
	attach: function() {
		var that = this,
			sidebarEl = $(this);
			
		// highlight branch on click
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .label)'.substitute(this.options), function(e) {
			that.setSelectedFile($(e.target).getParent('li'))
		});
		
		//adding modules to Lib
		$(this.trees.lib).addEvent('click:relay(li.top_branch > .holder .add)'.substitute(this.options), function(e) {
			that.promptNewFile();
		});
		
		//adding attachments to Data
		$(this.trees.data).addEvent('click:relay(li.top_branch > .holder .add)'.substitute(this.options), function(e) {
			that.promptAttachment();
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
				'renameComplete': function(li, span) {
					//li.retrieve('file')
				},
				'deleteBranch': function(li) {
					
				}
			});
		});
		
		return this;
	},
	
	removeFileFromTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this;
		
		$(tree).getElements('li[title="{filename}.{type}"]'.substitute(file.options)).some(function(el) {
			if(el.retrieve('file') == file) {
				el.dispose();
				return true;
			}
		});
	},
	
	addFileToTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this;
		
		tree.addPath(file, {
			target:	$(tree).getElement('.top_branch'),
			suffix: '.'+file.options['type'],
			url: file.options.url
		});	
		tree.collapse.prepare();
		file.addEvent('destroy', function() {
			that.removeFileFromTree(treeName, file);
		});
	}.protect(),
	
	addLib: function(lib) {
		this.addFileToTree('lib', lib);
	},
	
	addData: function(attachment) {
		this.addFileToTree('data', attachment);
	},
	
	addPlugin: function(plugin) {
		this.addFileToTree('plugin', plugin);
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
			title: 'Are you sure you want to remove {filename}.js?'.substitute(file.options),
			message: 'You may always copy it from this revision',
			ok: 'Remove',
			id: 'remove_module_button',
			callback: function() {
				fd.getItem().removeModule(file);
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
	
	toElement: function() {
		return this.element;
	}
	
});