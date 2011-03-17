/* 
 * File: Flightdeck.Utils.js
 */

Window.implement({
	$log: function(){
		if (typeof console !== 'undefined' && typeof console.log !== 'undefined'){
			console.log(arguments.length <= 1 ? arguments[0] : arguments);
		}
	}
});


(function() {

Slick.definePseudo('hidden', Element.prototype.isHidden)

Slick.definePseudo('visible', Element.prototype.isVisible);

})();
