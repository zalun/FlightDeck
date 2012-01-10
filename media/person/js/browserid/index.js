/*global navigator*/
var dom = require('shipyard/dom'),
    Request = require('shipyard/http/Request'),
    URI = require('shipyard/utils/URI');

// for minifier to include flightdeck app, since it's currently always
// initiated in base.html
var flightdeck = require('flightdeck');


exports.init = function(fd) {
	dom.$('UI_BrowserID_Img').addListener('click',function(){
		navigator.id.getVerifiedEmail(function(assertion) {
			if (assertion) {
			
				new Request({
					url: '/user/browserid-login/',
					headers: {
						'X-CSRFToken': dom.$$('input[name=csrfmiddlewaretoken]').get('value')
					},
					method: 'POST',
					data: {
						assertion: assertion
					},
					onSuccess: function(res){
						var next = new URI(String(dom.window.get('location'))).getData('next');
						dom.window.getNode().location = next || '/user/dashboard';
					},
					onFailure: function(res){
						if(this.xhr.status === 401){
							fd.error.alert("BrowserID login failed",
								"Is this e-mail registered at addons.mozilla.org?");
						} else if(this.xhr.status === 403 ){
							fd.error.alert("BrowserID",
								"Not enabled");
						}
					}
				}).send();
			} else {
				fd.error.alert("BrowserID Login Failed",
					"Please try again");
			}
		});
	});

    var old_auth = dom.$('old_auth');
    if (old_auth) {
        old_auth.addListener('click', function(e) {
            e.stop();
            dom.$('login_form').setStyle('display', 'block');
        });
    }
};
