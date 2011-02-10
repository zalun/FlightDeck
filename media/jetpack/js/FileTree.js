FileTree = new Class({
	
	Extends: Tree,
	
	options: {
		branch: {
			'rel': 'file',
			'title': 'Untitled',
			'id': null,
			'class': ''
		},
		editable: true,
		actions: {
			//add: false,
			//edit: false,
			//remove: false
		},
		snap: 3,
		id_prefix: ''
		//onAddBranch: function(el, attributes, target){}
		//onRenameStart: function(li, span){}
		//onRenameComplete: function(li, span){}
		//onDeleteBranch: function(li, span){}
	},
	
	attach: function(){
		this.parent();
		var that = this;
		this.element.addEvents({
			'mousedown:relay(.actions .edit)': function(e) {
				var li = e.target.getParent('li');
				if (li.hasClass('editing')) {
	    			that.renameBranchEnd($(e.target).getParent('li'));
				} else {
    				that.renameBranch($(e.target).getParent('li'));
				}
				
				
			},
			'keypress:relay(span)': function(e){
				if(e.key == 'enter') that.renameBranchEnd($(e.target).getParent('li'));
			}
		});
		return this;
	},
	
	mousedown: function(element, event) {
		//tree.js prevents event immediately, when really we only want
		//the event prevents when it drags. This is because if the element
		//has contentEditable active, we want the default mousedown action,
		//which is to move the cursor around the text node. If it's not,
		//then preventDefault will be called twice, and the dragging will still
		//work. :)
		
		var oldDefault = event.preventDefault;
		event.preventDefault = function(){
			event.preventDefault = oldDefault;
		};
		
		this.parent(element, event);
		if (this.clone) {
			this.clone.setStyle('display', 'none');
		}
		return this;
	},
	
	onDrag: function(el, event) {
		this.parent(el, event);
		if (this.clone) {
			this.clone.setStyle('display', null); //default snap is already 6px
		}
	},
	
	addBranch: function(attr, target, options){
		attr = Object.merge({}, this.options.branch, attr);
		target = $(target) || this.element;
		if (target.get('tag') !== 'ul') {
			target = target.getElement('ul');
		}
		options = Object.merge({}, {
			add: attr.rel == 'directory' ? true : false,
			edit: attr.rel == 'directory' ? false : true,
			remove: true, //can delete anything
			collapsed: true
		}, this.options.actions, options);
		attr.html = ('<a class="expand" href="#"></a>' +
			'<div class="holder">' +
				'<span id="{id}" class="label" title="{title}">{title}</span><span class="icon"></span>' +
				'<div class="actions">{add}{edit}{remove}</div>' +
			'</div>{dir}').substitute({
			title: attr.title,
			id: attr.name ? attr.name + '_switch' : attr.title + '_folder',
			dir: attr.rel == 'directory' ? '<ul' + (options.collapsed ? ' style="display:none;"' : '') + '></ul>' : '',
			add: options.add ? '<span class="add" title="Add"></span>' : '',
			edit: options.edit ? '<span class="edit" title="Rename"></span>' : '',
			remove: options.remove ? '<span class="delete" title="Delete"></span>' : ''
		});
		
		var li = new Element('li', attr),
			where = 'bottom';
		
		//branches should always be in alpha order
		//so, find the place to inject the new branch
		target.getChildren('li').some(function(el) {
			if (el.get('title') > attr.title) {
				target = el;
				where = 'before';
				return true;
			}
			return false;
		});
		
		li.inject(target, where);
		this.fireEvent('addBranch', [li].combine(arguments));
		return li;
	},
	
	renameBranch: function(element, hasExtension){
		var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.get('text').trim();
		
		this.fireEvent('renameStart', [li, label]);
		
		
		label.set('tabIndex', 0).set('contenteditable', true).focus();
		li.addClass('editing');
		label.store('$text', text);
		
		label.store('$blur', function blur(e) {
			label.removeEvent('blur', blur);
			this.renameBranchCancel(element);
		}.bind(this))
		
		label.addEvent('blur', label.retrieve('$blur'))
		
		hasExtension = hasExtension || !!text.getFileExtension();
		
		var range = document.createRange(),
			node = label.firstChild;
		range.setStart(node, 0);
		range.setEnd(node, hasExtension ? text.length - text.getFileExtension().length -1 : text.length);
		sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);

		return this;
	},
	
	renameBranchCancel: function(element) {
        var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.retrieve('$text').trim();
		
		label.set('contenteditable', false);
		if (text) {
		    label.set('text', text);
		}
		label.eliminate('$text');
		li.removeClass('editing');
		
	},
	
	renameBranchEnd: function(element) {
	    var li = (element.get('tag') == 'li') ? element : element.getParent('li'),
			label = li.getElement('.label'),
			text = label.get('text').trim();
		
	    if(label.get('contenteditable') == 'true'){
			
			//validation
			$log(text);
			text = text.replace(/[^a-zA-Z0-9\-_\.]+/g, '-');
		    
		    
			if (!text.getFileName()) {
			    fd.error.alert('Filename must be valid', 'Your file must not contain special characters, and requires a file extension.');
			    return this;
			}
			
			label.removeEvent('blur', label.retrieve('$blur'));
			label.eliminate('$text');
			label.set('contenteditable', false).blur();
			window.getSelection().removeAllRanges();
			
			li.removeClass('editing');
			//fire a renameCancel if the name didnt change
			if (text == label.get('title').trim()) {
				this.fireEvent('renameCancel', li);
				return this;
			}
			
			label.set('title', text);
			li.set('title', text);
			
			
			this.fireEvent('renameComplete', [li, this.getFullPath(li)]);
			return false;
		}
		
	},
	
	deleteBranch: function(element) {
		element.dispose();
		this.collapse.prepare();
		this.fireEvent('deleteBranch', element);
	},
	
	addPath: function(obj, options){
		options = options || {};
		var	suffix = options.suffix || '',
			splitted = obj.options.path.split('/'),
			elements = Array.clone(splitted),
			end = splitted.length - 1,
			selector = '',
			el,
			target = options.target,
			id_prefix = this.options.id_prefix;
			
		if (id_prefix) {
		    id_prefix += '-';
		}
		
		elements.each(function(name, i){
			var path = splitted.slice(0, i + 1).join('/');
			if (i == end){
				var previous = elements[i - 1] ? elements[i - 1].getElement('ul') : (options.target.getElement('ul') || options.target);
				el = elements[i] = previous.getChildren(selector += 'li[title='+ name + suffix +'] ')[0] || this.addBranch({
					'title': name + suffix,
					'name': name,
					'path': path,
					'url': obj.options.url,
					'id': obj.getID(),
					'rel': obj.options.type ? 'file' : 'directory',
					'class': 'UI_File_Normal' + (options.nodrag ? ' nodrag' : '')
				}, previous, options);
				
				elements[i].store('file', obj);
			} else {
				target = elements[i] = options.target.getElement(selector += '> ul > li[title='+ name +'] ') || this.addBranch({
					'title': name,
					'name': name,
					'rel': 'directory',
					'id': id_prefix + path.replace(/\//g, '-'),
					'path': path
				}, target, options);
			}
			
		}, this);
		
		return el;
	},
	
	getFullPath: function(branch) {
		var name = branch.get('title'),
			parentEl = branch.getParent('li');
			
		if (!parentEl.hasClass('top_branch')) {
			name = this.getFullPath(parentEl) + '/' + name;
		}
		return name;
	},
	
	toElement: function() {
		return this.element;
	}
});

FileTree.Collapse = new Class({
	
	Extends: Collapse.Cookie,
	
	updateElement: function(element){
		this.parent(element);
		this.updatePath(element);
	},
	
	updatePath: function(element){
		var parent = element.getParent('li'),
			path = parent ? parent.get('path') : false;
		element.set('path', (path ? path + '/' : '') + (element.get('path') || '').split('/').getLast());
	}
	
});

String.implement('getFileExtension', function() {
    var parts = this.split('.'),
        ext = parts.pop(),
        filename = parts.join('.');
        
    return !!filename && !!ext && !ext.match(/[^a-zA-Z0-9]/) && ext;
});

String.implement('getFileName', function() {
    var ext = this.getFileExtension();
    return ext && this.substring(0, this.length - ext.length - 1);
});
