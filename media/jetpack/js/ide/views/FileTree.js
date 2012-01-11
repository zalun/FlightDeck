var Class = require('shipyard/class/Class'),
    Tree = require('./tree/Tree'),
    LocalStorageCollapse = require('./tree/LocalStorageCollapse'),
    object = require('shipyard/utils/object'),
	string = require('shipyard/utils/string'),
    dom = require('shipyard/dom'),

    File = require('../models/File'),
    Module = require('../models/Module'),
    Attachment = require('../models/Attachment'),
    filename = require('../utils/filename');

var FileTree = module.exports = new Class({
    
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
        id_prefix: '',
        
        // if container is true, container will default to the Tree el
        // "false" will cancel the container
        container: true
        //onAddBranch: function(el, attributes, target){}
        //onRenameStart: function(li, span){}
        //onRenameComplete: function(li, span){}
        //onDeleteBranch: function(li, span){}
    },
    
    initialize: function(element, options) {
        this.addListener('change', function() {
            this.setFullPath(this.current);
        }, true);
        this.parent(element, options);
    },
    
    attach: function(){
        this.parent();
        var tree = this;

        this.element.delegate('.actions .edit', 'mousedown', function(e, edit) {
            var li = edit.getParent('li');
            if (li.hasClass('editing')) {
                tree.renameBranchEnd(edit);
            } else {
                tree.renameBranch(edit);
            }
            
            
        });

        // this selector is a huge WTF?
        // Basically, clicks on the label or icon of directories should
        // toggle open/closed the directory.
        this.element.delegate('li[rel="directory"] > .holder .label, li[rel="directory"] > .holder .icon', 'click', function(e, target){
            var li = target.getParent('li');
            tree.toggleBranch(li);
        });
        this.element.delegate('span', 'keypress', function(e, span){
            if(e.key === 'enter') {
                tree.renameBranchEnd(span.getParent('li'));
            }
        });
        
        return this;
    },
    
    mousedown: function(element, event) {
        this.parent(element, event);
        if (this._clone) {
            this._clone.setStyle('display', 'none');
        }
        return this;
    },
    
    onDrag: function(el, event) {
        this.parent(el, event);
        if (this._clone) {
            this._clone.setStyle('display', null); //default snap is already 6px
        }
    },
    
    toggleBranch: function(branch) {
        if (branch && this.collapse) {
            this.collapse.toggle(branch);
        }
    },
    
    removeBranch: function(branch) {
        var parent = branch.getParent('li');
        
        branch.dispose();
        
        if (parent && !parent.getElements('li').length && this.collapse) {
            this.collapse.collapse(parent);
        }
        
    },
    
    addBranch: function(attr, target, options){
        attr = object.merge({}, this.options.branch, attr);
        target = dom.$(target) || this.element;
        if (target.get('tag') !== 'ul') {
            target = target.getElement('ul');
        }
        
        var isEditable = this.options.editable;
        
        options = object.merge({}, {
            add: attr.rel === 'directory',
            edit: attr.rel !== 'directory',
            remove: true, //can delete anything
            collapsed: true
        }, this.options.actions, options);
        
        if (!isEditable) {
            delete options.add;
            delete options.edit;
            delete options.remove;
        }
        
        attr.html = string.substitute('<a class="expand" href="#"></a>' +
            '<div class="holder">' +
                '<span id="{id}" class="label" title="{title}">{title}</span><span class="icon"></span>' +
                '<div class="actions">{add}{edit}{remove}</div>' +
            '</div>{dir}', {
            title: attr.title,
            id: attr.name ? attr.name + '_switch' : attr.title + '_folder',
            dir: attr.rel === 'directory' ? '<ul' + (options.collapsed ? ' style="display:none;"' : '') + '></ul>' : '',
            add: options.add ? '<span class="add" title="Add"></span>' : '',
            edit: options.edit ? '<span class="edit" title="Rename"></span>' : '',
            remove: options.remove ? '<span class="delete" title="Delete"></span>' : ''
        });
        
        var li = new dom.Element('li', attr),
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
        this.emit('addBranch', li, attr, target, options);
        return li;
    },
    
    renameBranch: function(element, hasExtension){
        var li = (element.get('tag') === 'li') ? element : element.getParent('li'),
            label = li.getElement('.label'),
            text = label.get('text').trim();
        
        this.fireEvent('renameStart', li, label);
        
        
        label.set('tabIndex', 0).set('contenteditable', true).focus();
        li.addClass('editing');
        label.store('$text', text);
        
        label.store('$blur', function blur(e) {
            label.removeEvent('blur', blur);
            this.renameBranchCancel(element);
        }.bind(this));
        
        label.addEvent('blur', label.retrieve('$blur'));
        
        hasExtension = hasExtension || !!filename.extname(text);
        
        var range = dom.document.getNode().createRange(),
            node = label.firstChild;
        range.setStart(node, 0);
        range.setEnd(node, hasExtension ? text.length - filename.extname(text).length -1 : text.length);
        var sel = dom.window.getNode().getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        return this;
    },
    
    renameBranchCancel: function(element) {
        var li = (element.get('tag') === 'li') ? element : element.getParent('li'),
            label = li.getElement('.label'),
            text = label.retrieve('$text').trim();
        
        label.set('contenteditable', false);
        if (text) {
            label.set('text', text);
        }
        label.unstore('$text');
        li.removeClass('editing');
        
    },
    
    renameBranchEnd: function(element) {
        var li = (element.get('tag') === 'li') ? element : element.getParent('li'),
            label = li.getElement('.label'),
            text = label.get('text').trim();
        
        //TODO: Bad practice.
        var fd = dom.window.get('fd');

        if(label.get('contenteditable') === 'true'){
            
            //validation
            text = File.sanitize(text);
            
            
            if (!filename.basename(text)) {
                fd.error.alert('Filename must be valid', 'Your file must not contain special characters, and requires a file extension.');
                return this;
            }
            
            label.removeEvent('blur', label.retrieve('$blur'));
            label.unstore('$text');
            label.set('contenteditable', false).blur();
            dom.window.getNode().getSelection().removeAllRanges();
            
            
            li.removeClass('editing');
            //fire a renameCancel if the name didnt change
            if (text === label.get('title').trim()) {
                this.fireEvent('renameCancel', li);
                return this;
            }
            
            label.set('title', text);
            label.set('text', text);

            li.set('name', text);
            li.set('title', text);
            var path = this.getFullPath(li);
            li.set('path', path);
            
            
            this.fireEvent('renameComplete', [li, path]);
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
        var suffix = options.suffix || '',
            splitted = obj.get('fullName').split('/'),
            elements = object.clone(splitted),
            end = splitted.length - 1,
            selector = '',
            tree = this,
            el,
            url = options.url,
            target = options.target,
            id_prefix = this.options.id_prefix,
            rel = (obj instanceof Module || obj instanceof Attachment) ?
                'file':
                'directory';
            
        if (id_prefix) {
            id_prefix += '-';
        }
        
        //TODO: my eyes!
        elements.forEach(function(name, i){
            var path = splitted.slice(0, i + 1).join('/');
            if (i === end){
                var previous = elements[i - 1] ? elements[i - 1].getElement('ul') : (options.target.getElement('ul') || options.target);
                el = elements[i] = previous.getChildren(selector += 'li[title='+ name + suffix +'] ')[0] || this.addBranch({
                    'title': obj.get('shortName'),
                    'name': obj.get('shortName'),
                    'path': path,
                    'url': url,
                    'id': options.id,
                    'rel': rel,
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
        
        //slap a dirty bind onto that branch
        obj.observe('filename', function() {
            if (el) {
                var label = el.getElement('.label');
                var shortname = this.get('shortName');
                label.set({
                    title: shortname,
                    text: shortname
                });
                el.set({
                    title: shortname,
                    name: shortname
                });
                tree.setFullPath(el);
            }
        });
        
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
    
    setFullPath: function(branch, path) {
        if (!path) {
            path = this.getFullPath(branch);
        }
        branch.set('path', path);
        return branch;
    },
    
    toElement: function() {
        return this.element;
    }
});

FileTree.Collapse = new Class({
    
    Extends: LocalStorageCollapse,
    
    updateElement: function(element){
        this.parent(element);
        this.updatePath(element);
    },
    
    updatePath: function(element){
        var parent = element.getParent('li'),
            path = parent ? parent.get('path') : false;
        element.set('path', (path ? path + '/' : '') + (element.get('path') || '').split('/').pop());
    }
    
});
