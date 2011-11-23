/* depends on `fd`
 */


var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    log = require('shipyard/utils/log'),
    
    tabs = require('../views/Tabs');

module.exports = new Class({

    Implements: Events,

    $tabs: [],

    initialize: function() {
        var controller = this;
		this.tabs = new tabs.TabBar('editor-tabs', {
			arrows: false,
			onTabDown: function(tab) {
				if (!tab.hasClass('selected')) {
					controller.fireEvent('select', tab.retrieve('tab:instance'));
				}
			},
			onCloseDown: function(tabClose) {
				var tabEl = tabClose.getParent('.tab');
				var isMoreTabs = controller.$tabs.length > 1;
				if(isMoreTabs) {
                    //TODO: allow user to delete all Tabs
					var tab = tabEl.retrieve('tab:instance'),
						that = this,
						file = tab.file;
						
					function closeTab() {
						tab.destroy();
					}
					
					if(file.changed) {
						fd.showQuestion({
							title: 'Lose unsaved changes?',
							message: 'The tab "'+file.get('shortName')+'" that you are trying to close has unsaved changes.',
							buttons: [
								{
									'type': 'reset',
									'text': 'Cancel',
									'class': 'close'
								},
								{
									'type': 'submit',
									'text': 'Close Tab',
									'id': 'close_tab_btn',
									'default': true,
									'irreversible': true,
									'callback': function() {
										closeTab();
										//do this after editor changes instances, cause editor
										//dumps content when it changes
										setTimeout(function() {
											file.content = file.original_content;
											file.setChanged(false);
											fd.item.edited--;
											if(!fd.item.edited) {
												fd.item.fireEvent('reset');
											}
										}, 1);
									}
								}
							]
						});
					} else {
						closeTab();
					}
				}
				
			}
		});
        
    },

    addTab: function(file) {
        var controller = this;
        var tab = new tabs.Tab(this.tabs, {
            title: file.get('shortName')
        });

        function change() {
            $(tab).addClass('modified');
        }

        function reset() {
            $(tab).removeClass('modified');
        }

        function destroy() {
            tab.destroy();
        }

        function changeName() {
            tab.setLabel(this.get('shortName'));
        }

        var changePtr = file.addEvent('dirty', change);
        var resetPtr = file.addEvent('reset', reset); 
        var destroyPtr = file.addEvent('destroy', destroy);
        var observePtr = file.observe('filename', changeName);

        tab.addEvent('destroy', function() {
            changePtr.remove();
            resetPtr.remove();
            destroyPtr.remove();
            observePtr.remove();
            delete tab.file;
            controller.removeTab(tab);
        });
		tab.file = file;

        
        this.$tabs.push(tab);
        return tab;
    },

    removeTab: function(tab) {
        //For now, simply pops the tab off the internal $tabs array
        //TODO: this should probably be where all the tab destruction
        //happens, instead of that massive indent-monster in the
        //initialize method
        var index = this.$tabs.indexOf(tab);
        if (index >= 0) {
            this.$tabs.splice(index, 1);
        }

        //we need to switch to another tab
        var tabEl = $(tab);
        var nextTab = tabEl.hasClass('selected') ?
					tabEl.getPrevious('.tab') || tabEl.getNext('.tab') :
					$(this.tabs).getElement('.tab.selected');
        if (nextTab) {
            this.tabs.fireEvent('tabDown', nextTab);
        } else {
            //TODO: this should just show a "Open a file on the left"
            log.error('Another tab couldn\'t be found !');
        }
    },

    selectTab: function(file) {
        var tab = this.getTab(file) || this.addTab(file);
        this.tabs.setSelected(tab);
    },

    getTab: function(file) {
        for (var i = 0, len = this.$tabs.length; i < len; i++) {
            if (this.$tabs[i].file == file) {
                return this.$tabs[i];
            }
        }
  
    }

});
