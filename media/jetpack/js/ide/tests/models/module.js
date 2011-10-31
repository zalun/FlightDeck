var Module = require('../../models/Module'),
    mockXHR = require('shipyard/test/mockXHR'),
    Spy = require('shipyard/test/Spy');

module.exports = {
    'Module': function(it, setup) {

        it('should be able to get fullName (filename + ext)', function(expect) {
            var m = new Module({ filename: 'events/key.press' });
            expect(m.get('fullName')).toBe('events/key.press.js');
        });

        it('should be able to get shortName', function(expect) {
            var m = new Module({ filename: 'main'});
            expect(m.get('shortName')).toBe('main.js');

            m.set('filename', 'events/key.down');
            expect(m.get('shortName')).toBe('key.down.js');
        });

        it('should be able to loadContent', function(expect) {
            var mod = { code: 'test content' };
            mockXHR(mod);
            var m = new Module();
            var fn = new Spy();
            m.addEvent('loadcontent', fn);
            m.loadContent(function(content) {
                expect(content).toBe(mod.code);
                expect(m.get('content')).toBe(mod.code);
                expect(fn.getCallCount()).toBe(1);
            });
        });

    }
};
