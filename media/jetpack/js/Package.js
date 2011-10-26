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
		if (this.active) {
			// switch editor!
			mod = null;
			// try to switch to first element
			first = false;
			Object.each(this.pack.modules, function(mod) {
				if (!first) {
					first = true;
					editor.sidebar.setSelectedFile(mod);
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

    setChanged: function(isChanged) {
        if (this.changed != isChanged) {
            this.fireEvent(isChanged ? 'change' : 'reset');
        }
        this.changed = isChanged;
    }
	
});


File.sanitize = function(name) {
    return name.replace(/[^a-zA-Z0-9=!@#\$%\^&\(\)\+\-_\/\.]+/g, '-');
};

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

		this.addEvent('destroy', function(){
			delete pack.attachments[this.options.uid];
		});
		// create editor
        pack.editor.registerItem(this);
	},

	loadContent: function() {
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
        this.options.path = options.filename + '.' + options.type;
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
	return Object.some(fd.item.attachments, function(att) {
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

        // an uid for the editor
        this.uid = this.options.filename + this.options.suffix;
		// create editor
        pack.editor.registerItem(this);
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
	return Object.some(fd.item.modules, function(mod) {
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
	return Object.some(fd.item.folders, function(folder) {
		return (folder.options.root_dir == root_dir &&
				folder.options.name == filename);
	});
};
