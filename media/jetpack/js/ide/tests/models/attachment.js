var Attachment = require('../../models/Attachment');

module.exports = {
    'Attachment': function(it, setup) {
        it('should get fullName from filename + ext', function(expect) {
            var att = new Attachment({ filename: 'example.mode.html' });
            expect(att.get('fullName')).toBe('example.mode.html.js');

            att.set('filename', 'example/mode.html');
            att.set('ext', 'txt');
            expect(att.get('fullName')).toBe('example/mode.html.txt');
        });

        it('should be able to get shortName', function(expect) {
            var att = new Attachment({ filename: 'really/long/path/file' });

            expect(att.get('shortName')).toBe('file.js');
        });

        it('should be editable if a text type', function(expect) {
            var att = new Attachment();
            expect(att.isEditable()).toBe(true);
            att.set('ext', 'css');
            expect(att.isEditable()).toBe(true);
        });

        it('should not be editable if img', function(expect) {
            var att = new Attachment({ ext: 'png' });
            expect(att.isEditable()).toBe(false);
        });
    }
};
