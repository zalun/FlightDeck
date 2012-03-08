// Some defaults that Request should use, like always sending the
// CSRFToken, or always showing an error message onFailure
var Request = require('shipyard/http/Request'),
    Cookie = require('shipyard/utils/Cookie'),
    log = require('shipyard/utils/log'),
    dom = require('shipyard/dom');

function fd() {
    return dom.window.get('fd');
}

Request.prototype.options.headers['X-CSRFToken'] = Cookie.read('csrftoken');

var oldInit = Request.prototype.initialize;
var defaultFailure = function(text) {
    if (this.status !== 0 && text) {
        var response;
        try {
            response = JSON.parse(text);
        } catch (notJSON) {
            log.warn('Response error is not valid JSON');
            if (text.indexOf('<html') !== -1) {
                // We somehow got a full HTML page. Bad!
                log.error('Response is an HTML page!');
                response = 'Something aweful happened.';
            } else {
                // A simple text message
                response = text;
            }
        }

        fd().error.alert(this.xhr.statusText, response);
    }
};

Request.implement('initialize', function FD_Request(options) {
    if (!options) {
        options = {};
    }
    if (!options.onFailure) {
        options.onFailure = defaultFailure;
    }
    oldInit.call(this, options);
});
