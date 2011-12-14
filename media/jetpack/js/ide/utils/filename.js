var notAlphaNum = /[^a-zA-Z0-9]/;

var extname = exports.extname = function(str) {
    var parts = String(str).split('.'),
        ext = parts.pop(),
        filename = parts.join('.');

    return !!filename && !!ext && !ext.match(notAlphaNum) && ext;
};

var basename = exports.basename = function(str) {
    str = String(str);
    var ext = extname(str);
    return ext && str.substring(0, str.length - ext.length - 1);
};
