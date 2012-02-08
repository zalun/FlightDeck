var dom = require('shipyard/dom'),
    Request = require('shipyard/http/Request'),
    Events = require('shipyard/class/Events'),
    typeOf = require('shipyard/utils/type').typeOf,
    object = require('shipyard/utils/object'),
    string = require('shipyard/utils/string'),
    Cookie = require('shipyard/utils/Cookie'),

    Spy = require('shipyard/test/Spy'),
    mockXHR = require('shipyard/test/mockXHR');

var fd = new Events();
fd.message = {};
fd.setURIRedirect = new Spy();

dom.window.set('fd', fd);

var Package = require('../../models/Package'),
    PackageRevision = require('../../models/PackageRevision'),
    PackageController = require('../../controllers/PackageController');


var BUTTONS = {
    'package-properties': string.uniqueID(),
    'package-copy': string.uniqueID(),
    'try_in_browser': string.uniqueID(),
    'download': string.uniqueID(),
    'error-console': string.uniqueID()
};


function resetDom() {
    dom.$$('body *').dispose();


    fd.removeListeners();
    dom.window.removeListeners();

    var body = dom.document.body;

    body.grab(new dom.Element('span', { id: 'package-info-name' }));
    body.grab(new dom.Element('input', { id: 'version_name' }));
    body.grab(new dom.Element('div', { id: 'revisions_list' }));
    body.grab(new dom.Element('input', { id: 'revision_message' }));
    body.grab(new dom.Element('a', { id: 'package-save' }));
    
    object.forEach(BUTTONS, function(href, id) {
        var a = new dom.Element('a', { href: href });
        var li = new dom.Element('li', { id: id });
        li.grab(a);
        body.grab(li);
    });
    
    fd.message.alert = new Spy();

    Cookie.write('csrftoken', string.uniqueID());
}

function E(type) {
    this.preventDefault = new Spy();
    this.stopPropagation = new Spy();
    if (type) {
        this.type = type;
    }
}

E.prototype = {
    type: 'click'
};



module.exports = {
    'PackageController': function(it, setup) {

        var addon;
        var editOptions = { readonly: false, check_dependencies: false };

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
            
            var pc = new PackageController(addon, editOptions);
            expect(pc).toBeAnInstanceOf(PackageController);
            expect(pc.package_).toBe(addon);
        });

        it('should bind the package version_name', function(expect) {
            var pc = new PackageController(addon, editOptions);

            expect(pc.versionEl.get('value')).toBe(addon.get('version_name'));

            var newVer = '0.5.1';
            addon.set('version_name', newVer);

            expect(pc.versionEl.get('value')).toBe(newVer);
        });

        it('should bind the package name', function(expect) {
            var pc = new PackageController(addon, editOptions);

            var name = 'new-name';
            addon.set('full_name', name);

            expect(pc.packageInfoNameEl.get('text')).toBe(name);

        });

        it('should register revisions_list click', function(expect) {
            var pc = new PackageController(addon, editOptions);

            pc.showRevisionList = new Spy();

            pc.revision_list_btn.emit('click', new E('click'));
            expect(pc.showRevisionList.getCallCount()).toBe(1);
        });

        /*
        This method currently uses fd.displayModel...
        it('should show revisions list', function(expect) {
            
        });*/

        
        it('should be able to determine if latest revision', function(expect) {
            var pc = new PackageController(addon, editOptions);

            mockXHR({ id: 1, revision_number: 3 });

            var failCallback = new Spy();
            pc.checkIfLatest(failCallback);

            mockXHR({ id: 2, revision_number: 1 });
            pc.checkIfLatest(failCallback);

            expect(failCallback.getCallCount()).toBe(1);
        });
        
        it('should get the test_url from the dom', function(expect) {
            var pc = new PackageController(addon, editOptions);
            expect(pc.getOption('test_url')).toBe(BUTTONS.try_in_browser);
        });

        it('should be bound to testAddon', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.testAddon = new Spy();
            pc.test_el.emit('click', new E('click'));
            expect(pc.testAddon.getCallCount()).toBe(1);
        });

        it('should get the download_url from the dom', function(expect) {
            var pc = new PackageController(addon, editOptions);
            expect(pc.getOption('download_url')).toBe(BUTTONS.download);
        });

        it('should be bound to downloadAddon', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.downloadAddon = new Spy();
            pc.download_el.emit('click', new E('click'));
            expect(pc.downloadAddon.getCallCount()).toBe(1);
        });

        it('should be bound to copyPackage', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.copyPackage = new Spy();
            pc.copy_el.emit('click', new E('click'));
            expect(pc.copyPackage.getCallCount()).toBe(1);
        });

        it('should be bound to checkIfLatest on window.focus', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.checkIfLatest = new Spy();
            dom.window.emit('focus', new E('focus'));
            expect(pc.checkIfLatest.getCallCount()).toBe(1);
        });

        it('should not be bound to checkIfLatest when viewing versions', function(expect) {
            var pc = new PackageController(addon, {
                check_if_latest: false,
                check_dependencies: false
            });
            pc.checkIfLatest = new Spy();
            dom.window.emit('focus', new E('focus'));
            expect(pc.checkIfLatest.getCallCount()).toBe(0);
        });

        it('should be bound to showInfo', function(expect) {
            var pc = new PackageController(addon, { readonly: true });
            pc.showInfo = new Spy();
            pc.packageInfoEl.emit('click', new E('click'));
            expect(pc.showInfo.getCallCount()).toBe(1);
        });


        // Edit Actions

        it('should be bound to editInfo', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.editInfo = new Spy();
            pc.packageInfoEl.emit('click', new E('click'));
            expect(pc.editInfo.getCallCount()).toBe(1);
        });

        it('should bind console_el to open console', function(expect) {
            var fd = { send: new Spy() };
            dom.window.node.mozFlightDeck = fd;

            var pc = new PackageController(addon, editOptions);
            pc.console_el.emit('click', new E('click'));
            expect(fd.send).toHaveBeenCalled();
            expect(fd.send.getLastArgs()).toBeLike(['toggleConsole', 'open']);

            delete dom.window.node.mozFlightDeck;
        });

        it('should bind save_el to saveAction', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.saveAction = new Spy();
            pc.save_el.emit('click', new E('click'));
            expect(pc.saveAction.getCallCount()).toBe(1);
        });

        it('should bind to onbeforeunload', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.alertUnsavedData = new Spy();
            dom.window.emit('beforeunload', new E('beforeunload'));
            expect(pc.alertUnsavedData.getCallCount()).toBe(1);
        });

        it('should generate a new hashtag when xpi is downloaded', function(expect) {
            var pc = new PackageController(addon, editOptions);
            pc.generateHashtag = new Spy();

            fd.emit('xpi_downloaded');

            expect(pc.generateHashtag.getCallCount()).toBe(1);
        });

        it('should create logical tab order in save popover', function(expect) {
            var pc = new PackageController(addon, editOptions);

            var versionFocus = new Spy(),
                saveFocus = new Spy();

            // jury-rig the .focus() methods to trigger our event
            // handlers
            pc.versionEl.focus = function() { this.emit('focus', new E('focus')); };
            pc.save_el.focus = pc.versionEl.focus;

            pc.versionEl.addListener('focus', versionFocus);
            pc.save_el.addListener('focus', saveFocus);

            pc.save_el.emit('mouseenter', new E('mouseenter'));
            expect(versionFocus.getCallCount()).toBe(1);

            var tab = new E('keypress');
            tab.keyCode = 9;
            //tab.key = 'tab';
            pc.revision_message_el.emit('keypress', tab);
            expect(saveFocus.getCallCount()).toBe(1);
        });

        it('should be able to upload Files as Attachments', function(expect) {
            var pc = new PackageController(addon, editOptions);
            var file = {
                name: 'a.js',
                fileSize: 4
            };

            mockXHR(function(data) {
                return {
                    filename: 'a',
                    ext: 'js',
                    author: 'Sean',
                    code: 'test',
                    get_url: string.uniqueID(),
                    uid: 5,
                    revision_string: 'Rev 5'
                };
            });

            pc.uploadAttachment([file]);
            expect(pc.attachments[5]).not.toBeUndefined();
        });
    }
};
