var Tips = require('../../views/FloatingTips'),
    dom = require('shipyard/dom');

module.exports = {
    
    'FloatingTips': function(it, setup) {
        var target;
        setup('beforeEach', function() {
            dom.$$('body *').dispose();

            target = new dom.Element('a', {
                'title': 'Click me'
            });

            dom.document.body.appendChild(target);
        });
        it('should work', function(expect) {
            expect(target.get('title')).toBe('Click me');
            var tips = new Tips('a');
            tips.show(target);
            expect(target.get('data-floatingtitle')).toBe('Click me');
        });
    }
    
};
