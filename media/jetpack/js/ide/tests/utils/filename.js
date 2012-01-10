var filename = require('../../utils/filename');

module.exports = {
    
    'extname': function(it, setup) {
        it('should find extensions in strings', function(expect) {
            expect(filename.extname('file.js')).toBe('js');
        });

        it('should find exts when there are multiple dots', function(expect) {
            expect(filename.extname('file.png.html')).toBe('html');
        });
    },

    'basename': function(it, setup) {
        it('should find filenames in strings', function(expect) {
            expect(filename.basename('file.js')).toBe('file');
        });

        it('should find filenames when there are multiple dots', function(expect) {
            expect(filename.basename('file.png.html')).toBe('file.png');
        });
    }

};
