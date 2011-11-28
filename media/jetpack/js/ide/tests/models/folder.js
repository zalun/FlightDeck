var Folder = require('../../models/Folder');

module.exports = {

    'Folder': function(it, setup) {
    
        it('should get the full name', function(expect) {
            var f = new Folder({ name: 'a/b/c' });
            expect(f.get('fullName')).toBe('a/b/c');
        });

        it('should get the short name', function(expect) {
            var f = new Folder({ name: 'a/b/c' });
            expect(f.get('shortName')).toBe('c');
        });
    }

};
