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

String.prototype.get_basename = function(isFolder) {
    basename = this.split('/').getLast();
    if (!isFolder) {
        basename = basename.split('.');
        if (basename.length > 1) {
            basename = basename.slice(0,-1);
        }
        basename = basename.join('.');
    }
    return basename;
};
})();

