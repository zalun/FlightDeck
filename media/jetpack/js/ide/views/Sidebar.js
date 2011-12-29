var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    dom = require('shipyard/dom'),
    object = require('shipyard/utils/object'),
    string = require('shipyard/utils/string'),
    log = require('shipyard/utils/log'),
    
    File = require('../models/File'),
    Module = require('../models/Module'),
    Attachment = require('../models/Attachment'),
    Folder = require('../models/Folder'),
    Package = require('../models/Package'),
    FileTree = require('./FileTree'),
    filename = require('../utils/filename'),
	Autocomplete = require('flightdeck/Autocomplete'),
    URI = require('../utils/URI');

//TODO: Bad practice.
var settings = dom.window.get('settings');

function fd() {
	return dom.window.get('fd');
}

//globals: FlightDeck.Autocomplete

var CLICK = 'click';

var Sidebar = module.exports = new Class({
    
    Implements: [Options, Events],
    
    options: {
        file_selected_class: 'UI_File_Selected',
        file_normal_class: 'UI_File_Normal',
        file_modified_class: 'UI_File_Modified',
        file_listing_class: 'tree',
        editable: false
    },
    
    trees: {},
    
    initialize: function(options){
        this.setOptions(options);
        this.element = dom.$('app-sidebar');
        //keyboard isn't working great, bug: 689382
        //this.bind_keyboard();
    },
    
    buildTree: function() {
        var that = this;
        var treeOptions = {
            checkDrag: function(el){
                return (el.get('rel') === 'file') && !el.hasClass('nodrag') && that.options.editable && !el.getElement('> .holder > .label[contenteditable="true"]');
            },
            checkDrop: function(el, drop){
                var isFile = el.get('rel') === 'file',
                    isSibling = this.current.getSiblings().contains(el);
                    
                return (
                        ((drop.isSubnode || isSibling) && isFile) ||
                        el.hasClass('top_branch') ||
                        isSibling && !isFile && !drop.isSubnode ||
                        !isFile && drop.isSubnode && this.current.getParent().getParent() === el
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
        var trees = this.trees;
        var topBranchOptions = {
            add: this.options.editable,
            edit: false,
            remove: false,
            collapsed: false
        };
        
        var location = dom.window.get('location');
        var addon_or_lib_url = location.pathname.match(/\/[a-z]+\/\d+\//g)[0]
                .replace(/\//g, '_');
        
        var collapseOptions = {
            getAttribute: function(element) {
                return element.get('path') || element.get('id');
            },
            getIdentifier: function(element) {
                return addon_or_lib_url + '_collapse_' + element.get('id');
            }
        };
        
        if(dom.$('LibTree') && !trees.lib) {
            trees.lib = new FileTree('LibTree', object.merge({
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
        
        if(dom.$('DataTree') && !trees.data) {
            trees.data = new FileTree('DataTree', object.merge({
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
            
        if(dom.$('PluginsTree') && !trees.plugins) {
            trees.plugins = new FileTree('PluginsTree', object.merge({}, treeOptions, { actions: {
                add: false,
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
            
            var sdkBranch = dom.$('core_library_lib');
            if(sdkBranch) {
                pluginsBranch.getElement('ul').appendChild(sdkBranch);
            }
            trees.plugins.collapse.prepare();
        }

        this.attach();
        
        return this;
    },
    
    attach: function() {
        var sidebar = this,
            sidebarEl = this.element;

        // highlight branch on click
        var hilightableBranchSelector = string.substitute('.{file_listing_class} li:not(.top_branch) .label:not([contenteditable="true"])', this.options);
        sidebarEl.delegate(hilightableBranchSelector, CLICK, function(e, label) {
            sidebar.selectBranch(label.getParent('li'));
        });
        
        //adding modules to Lib
        if(this.trees.lib) {
            dom.$(this.trees.lib).delegate('.add', CLICK, function(e, btn) {
                sidebar.promptNewFile(btn.getParent('li'));
            });
        }
        
        //adding attachments to Data
        if(this.trees.data) {
            dom.$(this.trees.data).delegate('.add', CLICK, function(e, btn) {
                sidebar.promptAttachment(btn.getParent('li'));
            });
        }
        
        //adding User Libraries to Plugins
        if(this.trees.plugins) {
            var pluginsEl = dom.$(this.trees.plugins);
            pluginsEl.delegate('li.top_branch > .holder .add', CLICK, function() {
                sidebar.promptPlugin();
            });
            pluginsEl.delegate('li.update > .holder .icon', CLICK, function(e, icon) {
                e.stop();
                sidebar.promptPluginUpdate(icon.getParent('li.update'));
            });
        }
        
        // delete
        var deleteBtnSelector = string.substitute('.{file_listing_class} li:not(.top_branch) .actions .delete', this.options);
        sidebarEl.delegate(deleteBtnSelector, CLICK, function(e, btn) {
            var li = btn.getParent('li'),
                file = li.retrieve('file'),
                isModules = li.getParent('.tree').get('id') === 'LibTree';
            if (file) {
                if (!sidebar.options.readonly) {
                    sidebar.promptRemoval(file);
                }
            } else {
                sidebar.promptRemoval(li.get('path'), isModules ? Module : Attachment);
                log.debug('a non-empty folder');
            }
            
        });
        
        object.forEach(this.trees, function(tree, name) {
            tree.addListener('renameComplete', function(li, fullpath) {
                var file = li.retrieve('file');
                if (file) {
                    sidebar.renameFile(li.retrieve('file'), fullpath);
                }
            });
        });
        
        return this;
    },
    
    renameFile: function(file, fullpath) {
        var pack = fd().item;
        if (file instanceof Module) {
            pack.renameModule(file.get('uid'), fullpath);
        } else if (file instanceof Attachment) {
            pack.renameAttachment(file.get('uid'), fullpath);
        }
    },
    
    removeFileFromTree: function(treeName, file) {
        var tree = this.trees[treeName],
            el;
            
        el = this.getBranchFromFile(file);
        delete this.uids[file.get('uid')];
        if (el) {
            tree.removeBranch(el);
        }
    },

    uids: {
        // uid: element ID
    },
    
    addFileToTree: function(treeName, file) {
        var tree = this.trees[treeName],
            that = this,
            isFile = file instanceof File;
            
        if (!tree) {
            this.buildTree();
            tree = this.trees[treeName];
        }

        var url;
        try {
            url = file.get('url');
        } catch(dontCare) {}
        
        var id = string.uniqueID();
        this.uids[file.get('uid')] = id;
        file.observe('uid', function(uid, old) {
            that.uids[uid] = id;
            delete that.uids[old];
        });

        var options = {
            target: dom.$(tree).getElement('.top_branch'),
            url: url,
            id: id
        };
    
        if (!this.options.editable || (isFile && file.get('main'))) {
            options.add = false;
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
        });

        // file.onChange should add an asterisk to the tree branch
        // file.onReset should remove the asterisk
        file.addEvent('dirty', function() {
            element.addClass(that.options.file_modified_class);
        });
        file.addEvent('reset', function() {
            element.removeClass(that.options.file_modified_class);
        });
        
        //check all of element's parents for Folders, destroy them
        this.silentlyRemoveFolders(element);
        
        if(isFile && (file.active || file.get('main')) && file.isEditable()) {
            this.setSelectedFile(element);
        }
    },
    
    addLib: function(lib) {
        this.addFileToTree('lib', lib);
    },
    
    removeFile: function(file, prefix) {
        //TODO: wtf
        if (file instanceof File) {
            file.destroy();
            return;
        }
            
        if (prefix) {
            prefix+='-';
        }
        var li = dom.$(prefix+file.replace(/\//g, '-'));
        
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
        var branch;
        
        var id = this.uids[file.get('uid')];
        if (id) {
            branch = dom.$(id);
        }
        return branch;
    },

    getBranchFromPath: function(path, treeName) {
        var tree = this.trees[treeName];
        if (!tree) {
            return null;
        }
        return dom.$(tree).getElement('li[path="'+path+'"]');
    },
    
    setSelectedFile: function(el) {
        var options = this.options;
        
        if (el instanceof File) {
            el = this.getBranchFromFile(el);
        }
        
        this.element.getElements('.'+options.file_listing_class+' li')
            .removeClass(options.file_selected_class)
            .addClass(options.file_normal_class);
        
        el.removeClass(options.file_normal_class)
            .addClass(options.file_selected_class);
        
        //also be sure to expand all parent folders
        var rootEl = el.getParent('.tree'),
            treeName = rootEl.get('id').toLowerCase().replace('tree',''),
            tree = this.trees[treeName],
            node = el;
        
        while (node = node.getParent('li')) {
            tree.collapse.expand(node);
        }
        
        return this;
    },
    
    selectBranch: function(li) {
        var file = li.retrieve('file');
        this.emit('select', file);
        this.setSelectedFile(li);
    },

    selectFile: function(file) {
        var el = this.getBranchFromFile(file);
        this.setSelectedFile(el);
    },
    
    silentlyRemoveFolders: function(element) {
        var node = element;
        while (node = node.getParent('li')) {
            
            var emptydir = node.retrieve('file');
            if (emptydir instanceof Folder) {
                emptydir.removeEvent('destroy', emptydir._removeFromTree);
                node.unstore('file');
                emptydir.destroy();
            }
        }
    },
    
    promptRemoval: function(file, fileType) {
        var title = 'Are you sure you want to remove {type}"{name}"?',
            titleOpts = {type: ''};

        if (fileType != null) {
            titleOpts.name = file + " and all its files";
        } else {
            titleOpts.name = file.get('fullName');
            if (file instanceof Folder) {
                titleOpts.type = "an empty folder ";
            }
        }
        
        
        titleOpts.name = titleOpts.name.split('/').getLast();
        fd().showQuestion({
            title: title.substitute(titleOpts),
            message: file instanceof Module ? 'You may always copy it from this revision' : '',
            buttons: [
                {
                    'type': 'reset',
                    'text': 'Cancel',
                    'class': 'close'
                },
                {
                    'type': 'submit',
                    'text': 'Remove',
                    'id': 'remove_file_button',
                    'default': true,
                    'irreversible': true,
                    'callback': function() {
                        if (file instanceof Module) {
                            fd().item.removeModule(file);
                        } else if (file instanceof Attachment) {
                            fd().item.removeAttachment(file);
                        } else if (file instanceof Package) {
                            fd().item.removeLibrary(file);
                        } else if (file instanceof Folder) {
                            fd().item.removeFolder(file);
                        } else if (fileType === Module) {
                            fd().item.removeModules(file);
                        } else if (fileType === Attachment) {
                            fd().item.removeAttachments(file);
                        }
                        
                    }
                }
            ]
        });
    },
    
    promptNewFile: function(folder) {
        var path = (folder && folder.get('path')) || '',
            isFolder = false;
        if (path) {
            path += '/';
        }
        
        fd().showQuestion({
            title: 'Create a new file or folder',
            message: '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>' +
                '<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>' +
                '<input type="text" name="new_file" id="new_file" placeholder="Enter name..." />',
            ok: 'Create',
            id: 'create_new_file',
            callback: function promptNewFile_callback() {
                // get data
                var fname_ = path + dom.$('new_file').get('value'),
                    pack = fd().item;
                    
                if (!filename) {
                    fd().error.alert(
                        'Filename can\'t be empty',
                        'Please provide the name of the module');
                    return;
                }
                
                // remove janky characters from filenames
                // (from promptAttachment)
                fname_ = File.sanitize(fname_);
                fname_ = fname_.replace(/\/{2,}/g, '/');

                if (fname_[fname_.length-1] === '/') {
                    isFolder = true;
                    fname_ = fname_.substr(0, fname_.length-1);
                } else {
                    //strip off any extensions
                    fname_ = fname_.replace(/^\//, '');
                    fname_ = fname_.replace(/\.[^\.]+$/, '');
                }
                
                if (!isFolder && pack.moduleExists(fname_)) {
                    fd().error.alert('Filename has to be unique', 'You already have the module with that name');
                    return;
                } else if (isFolder && pack.folderExists(fname_, Folder.ROOT_DIR_LIB)) {
                    fd().error.alert('Folder has to be unique', 'You already have the folder with that name');
                    return;
                }
                if (['-', ''].contains(fname_)) {
                    fd().error.alert(
                            'ERROR',
                            'Please use alphanumeric characters for filename');
                    return;
                }
                
                
                if (isFolder){
                    pack.addFolder(fname_, Folder.ROOT_DIR_LIB);
                } else {
                    pack.addModule(fname_);
                }
            }
        });

        //hookup File / Folder buttons
        var fileBtn = dom.$('new_type_file'),
            folderBtn = dom.$('new_type_folder');
            
        fileBtn.addListener('click', function(e) {
            e.stop();
            folderBtn.removeClass('selected');
            this.addClass('selected');
            isFolder = false;
        });
        
        folderBtn.addListener('click', function(e) {
            e.stop();
            fileBtn.removeClass('selected');
            this.addClass('selected');
            isFolder = true;
        });
    },
    
    promptAttachment: function(folder) {
        var basename,
            that = this,
            pack = fd().item,
            isFolder = false,
            path = (folder && folder.get('path')) || '';
        if (path) {
            path += '/';
        }
        fd().showQuestion({
            title: 'Create or Upload an Attachment',
            message: ''+
                '<form id="upload_attachment_form" method="post" enctype="multipart/form-data" action="'+
                    pack.options.upload_attachment_url + '">'+
                    '<input type="file" name="upload_attachment" id="upload_attachment"/></p>'+
                '</form>'+
                '<p style="text-align:center">&mdash; OR &mdash;</p><p>'+
                '<a href="#" id="new_type_file" class="radio_btn selected"><span>File</span></a>'+
                '<a href="#" id="new_type_folder" class="radio_btn"><span>Folder</span></a>'+
                '<input type="text" name="new_attachment" id="new_attachment" placeholder="New Attachment name..." />'+
                '<p style="text-align:center">&mdash; OR &mdash;</p><p>'+
                '<input type="text" name="external_attachment" id="external_attachment" placeholder="http:// (URI of an Attachment to download)"/></p>',
            ok: 'Create Attachment',
            id: 'new_attachment_button',
            callback: function() {
                var uploadInput = dom.$('upload_attachment'),
                    createInput = dom.$('new_attachment'),
                    externalInput = dom.$('external_attachment'),
                    fname_ = createInput.get('value'),
                    url = externalInput.get('value'),
                    renameAfterLoad,
                    files = uploadInput.getNode().files;

                if (url && !fname_) {
                    // extract filename from URL
                    var url_o = new URI(url);
                    fname_ = url_o.get('file');
                }
                
                //validation
                if(!(files && files.length) && !fname_ && !(url && fname_)) {
                    fd().error.alert('No file was selected.',
                            'Please select a file to upload.');
                    return;
                }
                
                for (var f = 0; f < files.length; f++){
                    var fname = filename.basename(files[f].name),
                        ex = filename.extname(files[f].name);
                        
                    if (fd().item.attachmentExists(fname +'.'+ ex)) {
                        fd().error.alert('Filename has to be unique',
                                'You already have an attachment with that name.');
                        return;
                    }
                }
                
                //if passed a folder to put the file in
                if (fname_) {
                    fname_ = path + fname_;
                } else if (path) {
                    renameAfterLoad = function(att) {
                        var el = that.getBranchFromFile(att);
                        if (el) {
                            el.destroy();
                        }

                        var new_name = path + att.get('filename');
                        // rename attachment (quietly) to place in the right
                        // folder
                        pack.renameAttachment(att.get('uid'), new_name, true);
                    };
                }
                
                if (fname_ && fname_[fname_.length-1] === '/') {
                    isFolder = true;
                    fname_ = fname_.substr(0, fname_.length-1);
                }
                
                //remove janky characters from filenames
                if (fname_) {
                    fname_ = fname_.replace(/[^a-zA-Z0-9=!@#\$%\^&\(\)\+\-_\/\.]+/g, '-');
                    fname_ = fname_.replace(/\/{2,}/g, '/');
                    fname_ = fname_.replace(/^\//, '');
                    fname_ = fname_.replace(/\/*$/g, ''); /* */
                    
                    if (!isFolder && !filename.extname(fname_)) {
                        // we're defaulting to .js files if the user doesnt
                        // enter an extension
                        fname_ = fname_.replace(/\./, '') + '.js';
                    }
                    // basename should have a meaning after replacing all
                    // non alphanumeric characters
                    if (['-', ''].contains(fname_)) {
                        fd().error.alert(
                                'ERROR',
                                'Please use alphanumeric characters for filename');
                        return;
                    }
                }
                
                if(files.length) {
                    pack.uploadAttachment(files, renameAfterLoad);
                } else if (isFolder) {
                    pack.addFolder(fname_, Folder.ROOT_DIR_DATA);
                } else if (url && fname_) {
                    pack.addExternalAttachment(url, fname_);
                } else if (fname_) {
                    pack.addAttachment(fname_);
                }
            }
        });
        
        //hookup File / Folder buttons
        var fileBtn = dom.$('new_type_file'),
            folderBtn = dom.$('new_type_folder');
            
        fileBtn.addListener('click', function(e) {
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
        var modal = fd().showQuestion({
            title: 'Add a Library',
            message: '<input type="text" name="new_library" id="new_library" placeholder="Search for libraries to include" />' +
                     '<input type="hidden" name="library_id_number" id="library_id_number" />',
            ok: 'Add Library',
            id: 'new_library_button',
            callback: function() {
                var lib_id = dom.$('library_id_number').get('value');
                if(!lib_id) {
                    fd().error.alert('No Library found!', 'Please enter the name of an existing Library');
                    return;
                }
                
                fd().item.assignLibrary(lib_id);
            }
        });
        
        //setup Library autocomplete
        // autocomplete
        var ac = new Autocomplete('new_library', settings.library_autocomplete_url, {
			valueField: 'library_id_number',
			valueFilter: function(data) {
				return data.id_number;
			}
		});
        modal.addListener('drag', function(el, evt) {
            ac.positionNextTo();
        });
		modal.addListener('destroy', function() {
			ac.destroy();
		});
    },

    setPluginUpdate: function(library, latest_revision) {
        var branch = this.getBranchFromFile(library);
        if (!branch || branch.hasClass('update')) {
            return;
        }
        
        branch.addClass('update');
        branch.getElement('.icon').set('title', 'Update to new version');
    },
    
    removePluginUpdate: function(library) {
        var branch = this.getBranchFromFile(library);
        if (!branch || !branch.hasClass('update')) {
            return;
        }
        
        branch.removeClass('update');
        branch.getElement('.icon').erase('title');
    },
    
    promptPluginUpdate: function(li) {
        var that = this,
            file = li.retrieve('file');
        fd().item.updateLibrary(file, function(response) {
            that.removePluginUpdate(file);
            //TODO: Somehow here rename the item
        });
    },
    
    /*focus: function() {
        this.keyboard.activate();
        
        this.element.getElements('.focused').removeClass('focused');

        //set top most branch as current if never focused before
        this._current_focus = this._current_focus || this.element.getElement('li');

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
    
    toggleFocused: function() {
        var current  = this._current_focus;
        if (!current) {
            return;
        }
        var treeName = current.getParent('ul.tree').get('id').replace('Tree','').toLowerCase();
        this.trees[treeName].collapse.toggle(current);
    },

    bind_keyboard: function() {
        var that = this;
        this.keyboard = new FlightDeck.Keyboard();
        this.keyboard.addShortcuts({
            'collapse': {
                keys:'left',
                description: 'Collapse focused folder.',
                handler: function(e) {
                    if(that._current_focus) {
                        var rel = that._current_focus.get('rel');
                        if(rel != 'file' && !(!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
                            that.collapseFocused();
                        }
                    }
                }
            },
            'expand': {
                keys: 'right',
                description: 'Expand focused folder',
                handler: function(e) {
                    if(that._current_focus) {
                        var rel = that._current_focus.get('rel');
                        if(rel != 'file' && !(!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
                            that.expandFocused();
                        }
                    }
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
                        if(rel == 'file' || (!that._current_focus.hasClass('top_branch') && that._current_focus.getParent('#PluginsTree'))) {
                            that.selectBranch(that._current_focus);
                        } else {
                            that.toggleFocused();
                        }
                    }
                }
            }
        });
        
    },*/

    toElement: function() {
        return this.element;
    }
    
});
