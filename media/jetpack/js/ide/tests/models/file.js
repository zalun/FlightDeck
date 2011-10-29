var File = require('../../models/File');

module.exports = {

    'File.sanitize': function(it, setup) {
        it('should clean out unwanted characters', function(expect) {
            var val = File.sanitize('<script>window.open()');
            expect(val).toBe('-script-window.open()');
        });

        it('should not strip plus characters', function(expect) {
            var val = File.sanitize('unload+');
            expect(val).toBe('unload+');
        });
    }
};
