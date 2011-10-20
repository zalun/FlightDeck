/* depends on `fd`
 */


var Class = require('shipyard/class/Class'),
    Events = require('shipyard/class/Events'),
    Options = require('shipyard/class/Options'),
    
    tabs = require('../views/Tabs');

module.exports = new Class({

    initialize: function() {
		this.tabs = new tabs.TabBar('editor-tabs', {
			arrows: false,
			onTabDown: function(tab) {
				if (!tab.hasClass('selected')) {
					tab.retrieve('tab:instance').file.onSelect();
				}
			},
			onCloseDown: function(tabClose) {
				var tabEl = tabClose.getParent('.tab');
				var nextTab = tabEl.hasClass('selected') ?
					tabEl.getPrevious('.tab.') || tabEl.getNext('.tab') :
					$(tabs).getElement('.tab.selected');
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
											fd.edited--;
											if(!fd.edited) {
												fd.fireEvent('reset');
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
        
    }

});
