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
		snap: 3
		//onAddBranch: function(el, attributes, target){}
		//onRenameStart: function(li, span){}
		//onRenameComplete: function(li, span){}
		//onDeleteBranch: function(li, span){}
	},
	
	attach: function(){
		this.parent();
		var that = this;
		this.element.addEvents({
			'click:relay(.actions .edit)': function(e) {
				that.renameBranch($(e.target).getParent('li'));
			},
			'keypress:relay(span)': function(e){
				if(e.key == 'enter') that.renameBranch(e.target);
			}
		});
		return this;
	},
	
	mousedown: function(element, event) {
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
			remove: attr.rel == 'directory' ? false : true,
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
			label = li.getElement('.label');
		
		this.fireEvent('renameStart', [li, label]);
		
		if(label.get('contenteditable') == 'true'){
			label.set('contenteditable', false).blur();
			window.getSelection().removeAllRanges();
			
			//fire a renameCancel if the name didnt change
			if (label.get('text').trim() == label.get('title').trim()) {
				this.fireEvent('renameCancel', li);
				return this;
			}
			
			label.set('title', label.get('text'));
			li.set('title', label.get('text'));
			
			this.fireEvent('renameComplete', [li, this.getFullPath(li)]);
			return false;
		}
		
		label.set('tabIndex', 0).set('contenteditable', true).focus();
		label.addEvent('blur', function blur(e) {
			label.removeEvent('blur', blur);
			this.renameBranch(element);
		}.bind(this))
		
		if(hasExtension){
			var range = document.createRange(),
				node = label.firstChild;
			range.setStart(node, 0);
			range.setEnd(node, label.get('text').split('.')[0].length);
			sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
		}

		return this;
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
			target = options.target;
		
		elements.each(function(name, i){
			var path = splitted.slice(0, i + 1).join('/');
			if (i == end){
				var previous = elements[i - 1] ? elements[i - 1].getElement('ul') : (options.target.getElement('ul') || options.target);
				el = elements[i] = previous.getChildren(selector += 'li[title='+ name + suffix +'] ')[0] || this.addBranch({
					'title': name + suffix,
					'name': name,
					'path': path,
					'url': obj.options.url,
					'rel': obj.options.type ? 'file' : 'directory',
					'class': 'UI_File_Normal' + (options.nodrag ? ' nodrag' : '')
				}, previous, options);
				
				elements[i].store('file', obj);
			} else {
				target = elements[i] = options.target.getElement(selector += '> ul > li[title='+ name +'] ') || this.addBranch({
					'title': name,
					'name': name,
					'rel': 'directory',
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