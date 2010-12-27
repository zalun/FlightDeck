FlightDeck = Class.refactor(FlightDeck, {
  initialize: function(options) {
    this.previous(options);
    var self = this;
    if (document.id('upload-package')) {
      document.id('upload-package').addEvent('click', function(ev) {
        if (ev) ev.stop();
        self.displayModal(''+
          '<div id="upload-package-form">'+
              '<h3>Upload Package</h3>'+
              '<div class="UI_Modal_Actions">'+
                  '<ul>'+
                      '<li><input id="submitModal" type="button" value="Upload" class="submitModal"/></li>'+
                      '<li><input type="reset" value="Cancel" class="closeModal"/></li>'+
                  '</ul>'+
              '</div>'+
          '</div>'
          );
      })
    }
  }
});
