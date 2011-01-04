FlightDeck = Class.refactor(FlightDeck, {
  options: {upload_package_modal: ''},
  initialize: function(options) {
    this.previous(options);
    var self = this;
    if (document.id('upload-package')) {
      document.id('upload-package').addEvent('click', function(ev) {
        if (ev) ev.stop();
        self.displayModal(self.options.upload_package_modal);
        document.id('upload-package-submit').addEvent('click', function(eve){
          // here add in JS functionality
          // it will be needed for interactive upload which will support 
          // adding Libraries
        })
      })
    }
  }
});
