/*global navigator*/
var dom = require('shipyard/dom'),
    Request = require('shipyard/http/Request'),
    log = require('shipyard/utils/log'),
    Anim = require('shipyard/anim/Animation'),
    URI = require('shipyard/utils/URI');

// for minifier to include flightdeck app, since it's currently always
// initiated in base.html
var flightdeck = require('flightdeck');

var LOADING_CLASS = 'loading';


function shake(element, times) {
    var anim = new Anim(element, {
        duration: 25,
        property: 'margin-left'
    });
    
    var distance = 2;
    var start = parseInt(element.getStyle('margin-left'), 10);
    var end = start + distance;
    var orig = start;
    anim.addListener('complete', function() {
        if (--times > 0) {
            anim.start(start, end);
            var tmp = start;
            start = end;
            end = tmp;
        } else if (times === 0) {
            anim.start(orig);
        }
    });
    
    anim.start(start, end);
    var tmp_ = start;
    start = end;
    end = tmp_ - distance;
}

exports.init = function(fd) {
	dom.$('UI_BrowserID_Img').addListener('click',function(){
        var button = this;
        button.addClass(LOADING_CLASS);
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
                    onComplete: function() {
                        button.removeClass(LOADING_CLASS);
                    },
					onSuccess: function(res){
						var next = new URI(String(dom.window.get('location'))).getData('next');
						dom.window.getNode().location = next || '/user/dashboard';
					},
					onFailure: function(res){
                        shake(button, 4);
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
                button.removeClass(LOADING_CLASS);
                shake(button, 4);
                log.warn('BrowserID login failed. No assertion returned.');
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
