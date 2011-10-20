var dom = require('shipyard/dom'),
    Request = require('shipyard/http/Request'),
    typeOf = require('shipyard/utils/type').typeOf,
    object = require('shipyard/utils/object'),
    string = require('shipyard/utils/string'),

    Spy = require('testigo/lib/spy').Spy,
    mockXHR = require('shipyard/test/mockXHR'),

    Package = require('../../models/Package'),
    PackageRevision = require('../../models/PackageRevision'),
    PackageController = require('../../controllers/PackageController');


var BUTTONS = {
    'package-properties': string.uniqueID(),
    'package-copy': string.uniqueID(), 
    'try_in_browser': string.uniqueID(), 
    'download': string.uniqueID(),
    'error-console': string.uniqueID(),
    'package-save': string.uniqueID()
}

function resetDom() {
    dom.$$('body *').dispose();

    dom.window.$events = {};

    var body = dom.document.body;

    body.grab(new dom.Element('input', { id: 'version_name' }));
    body.grab(new dom.Element('div', { id: 'revisions_list' }));
    
    object.forEach(BUTTONS, function(href, id) {
        var a = new dom.Element('a', { href: href });
        var li = new dom.Element('li', { id: id });
        li.grab(a);
        body.grab(li);
    });
    
}

function E() {
    this.preventDefault = new Spy;
    this.stopPropagation = new Spy;
}



module.exports = {
    'PackageController': function(it, setup) {

        var addon;

        setup('beforeEach', function() {
            resetDom();
            addon = new Package({
                full_name: 'foo bar',
                version_name: '0.5',
                type: 'a',
                revision_number: 2
            });
        });

        it('should instantiate', function(expect) {
            
            var pc = new PackageController(addon, {
                modules: [
                    {id: 1, filename: 'foo'},
                    {id: 2, filename: 'bar'}
                ]
            });
            expect(pc).toBeAnInstanceOf(PackageController);
            expect(pc.package).toBe(addon);
        });

        it('should bind the package version_name', function(expect) {
            var pc = new PackageController(addon, {});

            expect(pc.versionEl.get('value')).toBe(addon.get('version_name'));

            var newVer = '0.5.1';
            addon.set('version_name', newVer);

            expect(pc.versionEl.get('value')).toBe(newVer);
        });

        it('should register revisions_list click', function(expect) {
            var pc = new PackageController(addon, {});

            pc.showRevisionList = new Spy;

            pc.revision_list_btn.fireEvent('click');
            expect(pc.showRevisionList.getCallCount()).toBe(1);
        });

        /*it('should show revisions list', function(expect) {
            
        });*/

        it('should be able to determine if latest revision', function(expect) {
            var pc = new PackageController(addon);

            mockXHR({ id: 1, revision_number: 3 });

            var failCallback = new Spy;
            pc.checkIfLatest(failCallback);

            mockXHR({ id: 2, revision_number: 1 });
            pc.checkIfLatest(failCallback);

            expect(failCallback.getCallCount()).toBe(1);
        });
        
        it('should get the test_url from the dom', function(expect) {
            var pc = new PackageController(addon);
            expect(pc.getOption('test_url')).toBe(BUTTONS['try_in_browser'])
        });

        it('should be bound to testAddon', function(expect) {
            var pc = new PackageController(addon);
            pc.testAddon = new Spy;
            pc.test_el.fireEvent('click', new E);
            expect(pc.testAddon.getCallCount()).toBe(1);
        });

        it('should get the download_url from the dom', function(expect) {
            var pc = new PackageController(addon);
            expect(pc.getOption('download_url')).toBe(BUTTONS['download']);
        });

        it('should be bound to downloadAddon', function(expect) {
            var pc = new PackageController(addon);
            pc.downloadAddon = new Spy;
            pc.download_el.fireEvent('click', new E);
            expect(pc.downloadAddon.getCallCount()).toBe(1);
        });

        it('should be bound to copyPackage', function(expect) {
            var pc = new PackageController(addon);
            pc.copyPackage = new Spy;
            pc.copy_el.fireEvent('click', new E);
            expect(pc.copyPackage.getCallCount()).toBe(1);
        });

        it('should be bound to checkIfLatest on window.focus', function(expect) {
            var pc = new PackageController(addon);
            pc.checkIfLatest = new Spy;
            dom.window.fireEvent('focus', new E);
            expect(pc.checkIfLatest.getCallCount()).toBe(1);
        });

        it('should not be bound to checkIfLatest when viewing versions', function(expect) {
            var pc = new PackageController(addon, { check_if_latest: false });
            pc.checkIfLatest = new Spy;
            dom.window.fireEvent('focus', new E);
            expect(pc.checkIfLatest.getCallCount()).toBe(0);
        });

        it('should be bound to showInfo', function(expect) {
            var pc = new PackageController(addon);
            pc.showInfo = new Spy;
            pc.packageInfoEl.fireEvent('click', new E);
            expect(pc.showInfo.getCallCount()).toBe(1);
        });
    }
}
