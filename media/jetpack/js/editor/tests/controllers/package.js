var dom = require('shipyard/dom'),
    Request = require('shipyard/http/Request'),
    typeOf = require('shipyard/utils/type').typeOf,

    Spy = require('testigo/lib/spy').Spy,
    mockXHR = require('shipyard/test/mockXHR'),

    Package = require('../../models/Package'),
    PackageRevision = require('../../models/PackageRevision'),
    PackageController = require('../../controllers/PackageController');

function resetDom() {
    dom.$$('body *').dispose();

    var body = dom.document.body;

    body.grab(new dom.Element('input', { id: 'version_name' }));
    body.grab(new dom.Element('div', { id: 'revisions_list' }));
}



module.exports = {
    'PackageController': function(it, setup) {

        var pack;

        setup('beforeEach', function() {
            resetDom();
            pack = new Package({
                full_name: 'foo bar',
                version_name: '0.5',
                revision_number: 2
            });
        });

        it('should instantiate', function(expect) {
            
            var pc = new PackageController(pack, {
                modules: [
                    {id: 1, filename: 'foo'},
                    {id: 2, filename: 'bar'}
                ]
            });
            expect(pc).toBeAnInstanceOf(PackageController);
            expect(pc.package).toBe(pack);
        });

        it('should bind the package version_name', function(expect) {
            var pc = new PackageController(pack, {});

            expect(pc.versionEl.get('value')).toBe(pack.get('version_name'));

            var newVer = '0.5.1';
            pack.set('version_name', newVer);

            expect(pc.versionEl.get('value')).toBe(newVer);
        });

        it('should register revisions_list click', function(expect) {
            var pc = new PackageController(pack, {});

            pc.showRevisionList = new Spy;

            pc.revision_list_btn.fireEvent('click');
            expect(pc.showRevisionList.getCallCount()).toBe(1);
        });

        /*it('should show revisions list', function(expect) {
            
        });*/

        it('should be able to determine if latest revision', function(expect) {
            var pc = new PackageController(pack);

            mockXHR({ id: 1, revision_number: 3 });

            var failCallback = new Spy;
            pc.checkIfLatest(failCallback);

            expect(failCallback.getCallCount()).toBe(1);
        });
    }
}
