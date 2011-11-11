var Spinner = require('../../views/Spinner'),
    dom = require('shipyard/dom');

module.exports = {
    
    'Spinner': function(it, setup) {
        var target;
        setup('beforeEach', function() {
            dom.$$('body *').dispose();

            (new Array(5)).forEach(function() {
                dom.document.body.appendChild(new dom.Element('div'));
            });

            target = new dom.Element('div', {
                id: 'target',
                styles: {
                    height: 30,
                    width: 200
                }
            });
            dom.document.body.appendChild(target);

            (new Array(5)).forEach(function() {
                dom.document.body.appendChild(new dom.Element('div'));
            });
        });

        it('should insert as a nextSibling', function(expect) {
            var s = new Spinner('target');
            var el = dom.$(s);

            expect(target.node.nextSibling).toBe(el.node);
        });

        it('should resize appropriately', function(expect) {
            var s = new Spinner('target');
            s.resize();
            var el = dom.$(s);

            expect(el.getStyle('height')).toBe(target.getStyle('height'));
            expect(el.getStyle('width')).toBe(target.getSyle('width'));
        });
    }
    
};
