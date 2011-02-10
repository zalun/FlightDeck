API.Page = new Class({
    
    Implements: Options,
    
    options: {
        filename: '',
        path: ''
    },
    
    initialize: function(options) {
        this.setOptions(options);
        
        if (!this.options.path) this.options.path = this.options.filename;
    },
    
    getID: function() {
        return 'Page-' + this.options.filename.replace(/\//g, '-');
    }
    
});


FlightDeck = Class.refactor(FlightDeck, {

    options: {
        file_selected_class: 'UI_File_Selected',
        file_listing_class: 'tree',
        file_normal_class: 'UI_File_Normal'
    },
    
    initialize: function(options) {
        this.previous(options);
        
        var actions = { add: false, edit: false, remove: false };
        
        API.Tree = new FileTree('PackTree', {
            checkDrag: Function.from(false),
            editable: false,
            actions: actions
        });
        
        

		API.Tree.collapse = new FileTree.Collapse('PackTree', {});
		var top_branch = API.Tree.addBranch({
			'rel': 'directory',
			'title': 'Docs',
			'id': 'lib_branch',
			'class': 'top_branch nodrag'
		}, null, { actions: actions });
		API.Tree.collapse.prepare();
        
        
        doc_list.forEach(function(page) {
            var p = API.pages[page.filename] = new API.Page(page);
            var el = API.Tree.addPath(p, Object.merge({
               target: top_branch
            }, actions));
            API.Tree.collapse.prepare();
            el.store('page', p);
            if (p.options.selected) {
                
			    this.setSelectedFile(el);
            }
            
        }, this);
        
        $('PackTree').addEvent('click:relay(li:not(top_branch) > .holder > .label)', function(e, label) {
            var page = label.getParent('li').retrieve('page');
            if(page) {
                window.open(page.options.get_url);
            }
        });
    },
    
    setSelectedFile: function(el) {
        var options = this.options;
        
        $$('.'+options.file_listing_class+' li')
			.removeClass(options.file_selected_class)
			.addClass(options.file_normal_class);
		
		el.removeClass(options.file_normal_class)
			.addClass(options.file_selected_class);
		
		//also be sure to expand all parent folders
		var tree = API.Tree;
			node = el;
		
		while (node = node.getParent('li')) {
			tree.collapse.expand(node);
		}
    }
    
});
