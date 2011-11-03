var Package = require('../../models/Package');

module.exports = {
    'Package': function(it, setup) {
        it('should have a toString of its full_name', function(expect) {
            var p = new Package({ full_name: 'foo bar' });

            expect(String(p)).toBe('foo bar');
        });

        it('should have methods isAddon and isLibrary', function(expect) {
            var a = new Package({ type: 'a'});
            expect(a.isAddon()).toBe(true);
            expect(a.isLibrary()).toBe(false);

            var l = new Package({ type: 'l' });
            expect(l.isAddon()).toBe(false);
            expect(l.isLibrary()).toBe(true);
        });
    }
}
