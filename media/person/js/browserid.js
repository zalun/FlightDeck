document.addEvent('domready',function(){
	$('login-browserid') && $('login-browserid').addEvent('click',function(){
		navigator.id.getVerifiedEmail(function(assertion) {
			if (assertion) {
			
				new Request({
				url: '/user/browserid-login/',
				headers: {
						'X-CSRFToken': $$('[name="csrfmiddlewaretoken"]')[0].get('value')
				},
				method: 'POST',
				data: 'assertion='+assertion,
				onSuccess: function(res){
					window.location = '/user/dashboard/';							
				},					
				onFailure: function(res){
					if( res.status == 401){
						fd.error.alert("BrowserID login failed",
							"Please register at addons.mozilla.org first");
					}else if( res.status == 403 ){
						fd.error.alert("BrowserID",
							"Not enabled");
					}
				}
				}).send();
			} else {
				fd.error.alert("BrowserID Login Failed",
					"Invalid assertion");
			}
		});
	});
});
