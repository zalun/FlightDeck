var Module = require('../../models/Module');

module.exports = {
    'Module': function(it, setup) {

        it('should be able to get fullName (filename + ext)', function(expect) {
            var m = new Module({ filename: 'events/key.press' });
            expect(m.get('fullName')).toBe('events/key.press.js')
        });

        it('should be able to get shortName', function(expect) {
            var m = new Module({ filename: 'main'});
            expect(m.get('shortName')).toBe('main.js');

            m.set('filename', 'events/key.down');
            expect(m.get('shortName')).toBe('key.down.js');
        })
    }
}
