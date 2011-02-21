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
 
Function.extend('not', function(val) {
    return function() {
        return !Function.from(val).apply(this, arguments);
    };
})

var isHidden = function() {
   return (this.getStyle('display') == 'none'
       || this.getStyle('visibility') == 'hidden'
       || this.getStyle('opacity') == 0 
       //|| let posnode.getStyle.getPosition()
       );
};

Slick.definePseudo('hidden', isHidden)

Slick.definePseudo('visible', Function.not(isHidden));

})();
