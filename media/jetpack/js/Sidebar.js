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
		this.bind_keyboard();

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
				var file = this.current.retrieve('file');
				if (file) {
				    that.renameFile(file, this.getFullPath(this.current));
				}
                // remove this folder, since the back-end already deleted
                // it in a signal.
                that.silentlyRemoveFolders(this.current);
			},
			editable: this.options.editable
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
			trees.lib = new FileTree('LibTree', Object.merge({
			    id_prefix: 'l'
			}, treeOptions));
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
			trees.data = new FileTree('DataTree', Object.merge({
			    id_prefix: 'd'
			},treeOptions));
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
				'title': 'Libraries',
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
			that.selectFile($(e.target).getParent('li'));
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
			$(this.trees.plugins).addEvents({
				'click:relay(li.top_branch > .holder .add)': function(e) {
					that.promptPlugin();
				},
				'click:relay(li.update > .holder .icon)': function(e) {
					e.stop();
					that.promptPluginUpdate(e.target.getParent('li.update'));
				}
			});
		}
		
		// delete
		sidebarEl.addEvent('click:relay(.{file_listing_class} li:not(.top_branch) .actions .delete)'.substitute(this.options), function(e) {
			var li = $(e.target).getParent('li'),
			    file = li.retrieve('file'),
			    isModules = li.getParent('.tree').get('id') == 'LibTree';
			if (file) {
				if (!file.options.readonly) {
					that.promptRemoval(file);
				}
			} else {
				that.promptRemoval(li.get('path'), isModules ? Module : Attachment)
				$log('a non-empty folder');
			}
			
		});
		
		Object.each(this.trees, function(tree, name) {
			tree.addEvents({
				'renameComplete': function(li, fullpath) {
					var file = li.retrieve('file');
					if (file) {
					    that.renameFile(li.retrieve('file'), fullpath);
					} 					
				}
			});
		});
		
		return this;
	},
	
	renameFile: function(file, fullpath) {
		var pack = fd.getItem();
		if (file instanceof Module) {
			pack.renameModule(file.options.filename, fullpath);
		} else if (file instanceof Attachment) {
			pack.renameAttachment(file.options.uid, fullpath);
		}
	},
	
	removeFileFromTree: function(treeName, file) {
		var tree = this.trees[treeName],
			that = this,
			el;
			
		el = this.getBranchFromFile(file);
		if (el) {
			tree.removeBranch(el);
		}
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
			options.add = false
			options.edit = false;
			options.remove = false;
			options.nodrag = true;
		}
		
		
		var element = tree.addPath(file, options);	
		tree.collapse.prepare();
		
		
		file._removeFromTree = function() {
			that.removeFileFromTree(treeName, file);
		};
		
		file.addEvent('destroy', file._removeFromTree);
		file.addEvent('destroy', function() {
			element.erase('file');
		})
		
		//check all of element's parents for Folders, destroy them
		this.silentlyRemoveFolders(element);
		
		if((file.options.active || file.options.main) && file.is_editable()) {
			this.setSelectedFile(element);
		}
	}.protect(),
	
	addLib: function(lib) {
		this.addFileToTree('lib', lib);
	},
	
	removeFile: function(file, prefix) {
	    
	    if (file instanceof File) {
	        file.destroy();
	        return;
	    }
	        
        if (prefix) prefix+='-';
        var li = $(prefix+file.replace(/\//g, '-'));
        
        if (li) {
            li.destroy();
        }
	    
	    
	    
	},
	
	addData: function(attachment) {
		this.addFileToTree('data', attachment);
	},
	
	addPlugin: function(plugin) {
		this.addFileToTree('plugins', plugin);
	},
	
	getBranchFromFile: function(file) {
		var branch,
			title;
		
		if(file instanceof Library) {
			title = file.options.full_name;
		} else if (file instanceof Folder) {
			title = file.options.name;
		} else if (file instanceof Module 
                || file instanceof Attachment) {
			title = file.options.filename + '.' + file.options.type;
			
		} else {
            return null; //throw Error? this is a bad case!
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
	
	selectFile: function(li) {
		var file = li.retrieve('file');
		if(file) {
			if(file.is_editable()) {
				this.setSelectedFile(li);
			}
			
			file.onSelect();
		}
	},
    
    silentlyRemoveFolders: function(element) {
        var node = element;
        while (node = node.getParent('li')) {
            
        	var emptydir = node.retrieve('file');
        	if (emptydir instanceof Folder) {
        		emptydir.removeEvent('destroy', emptydir._removeFromTree);
        		node.eliminate('file');
        		emptydir.destroy();
        	}
        }
    },
	
	promptRemoval: function(file, fileType) {
		var title = 'Are you sure you want to remove "{name}"?',
		    titleOpts = {};
		
		if (fileType != null) {
		    titleOpts.name = file + " and all its files";
		} else {
		    titleOpts.name = file.options.path
		}
		
		if (fileType == Attachment) {
		    $log('FD: TODO: remove entire attachment folders');
		    //fd.alertNotImplemented('Deleting a Data folder with subcontent is under construction. A work around, is to manually delete every single attachment inside the folder before removing the folder. Ya, we know.');
		    //return;
		}
		
		var question = fd.showQuestion({
			title: title.substitute(titleOpts),
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
				} else if (file instanceof Folder) {
                    fd.getItem().removeFolder(file);
				} else if (fileType == Module) {
				    fd.getItem().removeModules(file);
				} else if (fileType == Attachment) {
                    $log('removing folder')
				    fd.getItem().removeAttachments(file);
				}
				
				
				question.destroy();
			}
		});
	},
	
	promptNewFile: function(folder) {
		var path = (folder && folder.get('path')) || '';
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
					//strip off any extensions
					filename = filename.replace(/^\//, '');
					filename = filename.replace(/\.[^\.]+$/, '');
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
	
	promptAttachment: function(folder) {
        var path = (folder && folder.get('path')) || '';
        if (path) path += '/';
        var that = this;
		var prompt = fd.showQuestion({
			title: 'Create or Upload an Attachment',
			message: '<input type="file" name="upload_attachment" id="upload_attachment"/></p>'
				+ '<p style="text-align:center">&mdash; OR &mdash;</p><p>'
				+ '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>'
				+ '<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>'
				+ '<input type="text" name="new_attachment" id="new_attachment" placeholder="New Attachment name..." />',
			ok: 'Create Attachment',
			id: 'new_attachment_button',
			focus: false, //dont auto focus since first option is to Upload
			callback: function() {
				var uploadInput = $('upload_attachment'),
					createInput = $('new_attachment'),
					filename = createInput.value,
					pack = fd.getItem(),
					renameAfterLoad,
                    files = uploadInput.files;
				
				//validation
				if(!(files && files.length) && !filename) {
					fd.error.alert('No file was selected.', 
                            'Please select a file to upload.');
					return;
				}
				
				for (var f = 0; f < files.length; f++){
					var fname = files[f].fileName.getFileName(),
						ex = files[f].fileName.getFileExtension();
						
					if (Attachment.exists(fname, ex)) {
						fd.error.alert('Filename has to be unique', 'You already have an attachment with that name.');
						return;
					}
				}
				
				//if passed a folder to put the file in
				if (filename) {
				    filename = path + filename;
				} else if (path) {
				    renameAfterLoad = function(att) {
				        var new_name = path + att.options.filename;
				        // rename attachment (quietly) to place in the right
                        // folder 
				        pack.renameAttachment(att.options.uid, new_name, true);
				        var el = that.getBranchFromFile(att);
				        if (el) {
				            el.destroy();
				        }
				        
				    };
				}
				
				if (filename && filename[filename.length-1] == '/') {
					isFolder = true;
					filename = filename.substr(0, filename.length-1);
				}
				
				//remove janky characters from filenames
				if (filename) {
				    filename = filename.replace(/[^a-zA-Z0-9\-_\/\.]+/g, '-');
				    filename = filename.replace(/\/{2,}/g, '/');
				    filename = filename.replace(/^\//, '');
				    filename = filename.replace(/\/*$/g, ''); /* */
				    
				    
				    if (!isFolder && !filename.getFileExtension()) {
				        
				        filename = filename.replace(/\./, '') + '.js'; //we're defaulting to .js files if the user doesnt enter an extension
				    }
				}
				
				if(files.length) {
					pack.sendMultipleFiles(uploadInput.files, renameAfterLoad);
				} else if (isFolder) {
					pack.addFolder(filename, Folder.ROOT_DIR_DATA);
				} else {
					pack.addAttachment(filename);
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
			title: 'Add a Library',
			message: '<input type="text" name="new_library" id="new_library" placeholder="Search for libraries to include" />' +
					 '<input type="hidden" name="library_id_number" id="library_id_number" />',
			ok: 'Add Library',
			id: 'new_library_button',
			callback: function() {
				var lib_id = $('library_id_number').value;
				if(!lib_id) {
					fd.error.alert('No Library found!', 'Please enter the name of an existing Library');
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

    setPluginUpdate: function(library, latest_revision) {
        var branch = this.getBranchFromFile(library);
        if (!branch || branch.hasClass('update')) return;
		
		branch.addClass('update');
        branch.getElement('.icon').set('title', 'Update to new version');
    },
	
	removePluginUpdate: function(library) {
		var branch = this.getBranchFromFile(library);
        if (!branch || !branch.hasClass('update')) return;
		
		branch.removeClass('update');
        branch.getElement('.icon').erase('title');
	},
	
	promptPluginUpdate: function(li) {
		var that = this,
			file = li.retrieve('file');
		fd.item.updateLibrary(file, function() {
			that.removePluginUpdate(file);
		});
	},
	
    focus: function() {
        this.keyboard.activate();
        
        $(this).getElements('.focused').removeClass('focused');

        //set top most branch as current if never focused before
        this._current_focus = this._current_focus || $(this).getElement('li');

        if (this._current_focus) {
            this._current_focus.addClass('focused');
        }
    },

    blur: function() {
        this.keyboard.deactivate();
        if (this._current_focus) {
            this._current_focus.removeClass('focused');
        }
    },

    focusPrevious: function() {
        var current = this._current_focus,
            el;

        if (!current) {
            this.focus();
            return;
        }
        //sorta opposite for "next"
        //1. if previous sibling has children
        //2. previous sibling
        //3. parent
		el = current.getElements('!+li ul:visible !^li, !+li, !li, !section !+ section ul:visible !^li');
		
		// Here, here!
		// Since there are multiple expressions (the commas), Slick sorts the
		// returned nodelist based on placement in the document. Since we're
		// going up the dom, and basically want the *lowest* li, we can pick
		// that off the end, and everything works. Heyyy!
		el = el[el.length-1];

        if (el) {
            this._current_focus = el;
            this.focus();
        }
    },

    focusNext: function() {
        var current  = this._current_focus,
            el;
        if (!current) {
            this.focus();
            return;
        }

        //try to find the next branch that isn't hidden
        //1. Is this branch open, and have children?
        //2. Does this branch have siblings?
		el = current.getElement('ul:visible li, ~ li, !li + li, !section + section li.top_branch');
        if (el) {
            this._current_focus = el;
            this.focus();
        }

    },
	
	expandFocused: function() {
		var current  = this._current_focus;
        if (!current) {
            return;
        }
		
		var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
		this.trees[treeName].collapse.expand(current);
	},
	
	collapseFocused: function() {
		var current  = this._current_focus;
        if (!current) {
            return;
        }
		var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
		this.trees[treeName].collapse.collapse(current);
	},

    bind_keyboard: function() {
        var that = this;
        this.keyboard = new Keyboard();
		this.keyboard.addShortcuts({
            'collapse': {
                keys:'left',
				description: 'Collapse focused folder.',
				handler: function(e) {
					that.collapseFocused();
                }
			},
			'expand': {
                keys: 'right',
				description: 'Expand focused folder',
				handler: function(e) {
					that.expandFocused();
                }
			},
			'up': {
                keys: 'up|k',
				description: 'Move focus up the tree.',
				handler: function(e) {
                    that.focusPrevious(); 
                }
			},
			'down': {
                keys: 'down|j',
				description: 'Move focus down the tree',
				handler: function(e) {
                    that.focusNext();
                }
			},
			'open': {
                keys: 'enter',
				description: 'Open currently focused file.',
				handler: function(e) {
					if(that._current_focus) {
						var rel = that._current_focus.get('rel');
						if(rel == 'file') {
							that.selectFile(that._current_focus);
						} else {
							
						}
					}
                }
            } 
        });
		
    },

	toElement: function() {
		return this.element;
	}
	
});
