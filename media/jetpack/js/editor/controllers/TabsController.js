/* depends on `fd`
 */


var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    
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
				var nextTab = tabEl.hasClass('selected') ?
					tabEl.getPrevious('.tab') || tabEl.getNext('.tab') :
					$(controller.tabs).getElement('.tab.selected');
				if(nextTab) {
					var tab = tabEl.retrieve('tab:instance'),
						that = this,
						file = tab.file;
						
					function closeTab() {
						tab.destroy();
						that.fireEvent('tabDown', nextTab);
					}
					
					if(file.changed) {
						fd.showQuestion({
							title: 'Lose unsaved changes?',
							message: 'The tab "'+file.getShortName()+'" that you are trying to close has unsaved changes.',
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
            title: file.getShortName()
        });

        function change() {
            $(tab).addClass('modified');
        }

        function reset() {
            $(tab).removeClass('modified');
        }

        file.addEvent('change', change);
        file.addEvent('reset', reset); 

        tab.addEvent('destroy', function() {
            file.removeEvent('change', change);
            file.removeEvent('reset', reset);
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
        if (index) {
            this.$tabs.splice(index, 1);
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
