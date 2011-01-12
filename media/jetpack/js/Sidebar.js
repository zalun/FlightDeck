
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
		
		
		trees.lib.collapse = new Collapse('LibTree');
		trees.lib.addBranch({
			'rel': 'directory',
			'title': 'Lib',
			'id': 'lib_branch',
			'class': 'top_branch nodrag'
		});
		
		trees.data.collapse = new Collapse('DataTree');
		trees.data.addBranch({
			'rel': 'directory',
			'title': 'Data',
			'id': 'data_branch',
			'class': 'top_branch nodrag'
		});
		
		trees.plugins.collapse = new Collapse('PluginsTree');
		trees.plugins.addBranch({
			'rel': 'directory',
			'title': 'Plugins',
			'id': 'plugins_branch',
			'class': 'top_branch nodrag'
		});
		
		return this;
	},
	
	attach: function() {
		var that = this;
		$(this).addEvent('click:relay(.{file_listing_class} li .label)'.substitute(this.options), function(e) {
			that.setSelectedFile($(e.target).getParent('li'))
		});
		
		Object.each(this.trees, function(tree, name) {
			tree.addEvent('renameComplete', function(li, span) {
				$log('rename complete', li, span);
			});
		});
		
		return this;
	},
	
	addPathToTree: function(treeName, obj) {
		var tree = this.trees[treeName];
		tree.addPath(obj, {
			target:	$(tree).getElement('.top_branch'),
			suffix: '.'+obj['type'],
			url: obj.url
		});	
		tree.collapse.prepare();
	}.protect(),
	
	addLib: function(lib) {
		this.addPathToTree('lib', lib);
	},
	
	addData: function(attachment) {
		this.addPathToTree('data', attachment);
	},
	
	addPlugin: function(plugin) {
		this.addPathToTree('plugin', plugin);
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
	
	toElement: function() {
		return this.element;
	}
	
});