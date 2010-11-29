from test_utils import TestCase

from django.contrib.auth.models import User

from jetpack.models import Package, PackageRevision, Module, Attachment
from jetpack.errors import SelfDependencyException, FilenameExistException, \
        DependencyException


class PackageRevisionTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.author = User.objects.get(username='john')
        self.addon = self.author.packages_originated.addons()[0:1].get()
        self.library = self.author.packages_originated.libraries()[0:1].get()

    def test_first_revision_creation(self):
        addon = Package(author=self.author, type='a')
        addon.save()
        revisions = PackageRevision.objects.filter(package__pk=addon.pk)
        self.assertEqual(1, revisions.count())
        revision = revisions[0]
        self.assertEqual(revision.author.username, addon.author.username)
        self.assertEqual(revision.revision_number, 0)
        self.assertEqual(revision.pk, addon.latest.pk)
        self.assertEqual(revision.pk, addon.version.pk)

    def test_save(self):
        # system should create new revision on save
        addon = Package(author=self.author, type='a')
        addon.save()
        revisions = PackageRevision.objects.filter(package__name=addon.name)
        first = revisions[0]
        first.save()
        revisions = PackageRevision.objects.filter(package__name=addon.name)
        self.assertEqual(2, revisions.count())

        # first is not the same package anymore and it does not have
        # the version_name parameter
        self.assertEqual(None, first.version_name)

        # "old" addon doesn't know about the changes
        self.assertNotEqual(addon.latest.revision_number,
                            first.revision_number)

        # reloading addon to update changes
        addon = first.package

        # first is the latest
        self.assertEqual(addon.latest.revision_number,
                         first.revision_number)
        self.assertNotEqual(addon.version.revision_number,
                            addon.latest.revision_number)

    def test_set_version(self):
        addon = Package(author=self.author, type='a')
        addon.save()
        first = addon.latest
        old_id = first.id
        first.set_version('test')

        # setting version does not make new revision
        self.assertEqual(first.id, old_id)

        # setting version sets it for revision, package
        # and assigns revision to package
        self.assertEqual(first.version_name, 'test')
        self.assertEqual(first.package.version_name, 'test')
        self.assertEqual(first.package.version.pk, first.pk)

    def test_adding_and_removing_dependency(self):
        revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
        count = revisions.count()
        first = revisions[0]
        lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]

        # first depends on lib
        first.dependency_add(lib)
        revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)

        # revisions number increased
        self.assertEqual(count + 1, revisions.count())

        first = revisions[1]
        second = revisions[0]

        # only the second revision has the dependencies
        self.assertEqual(0, first.dependencies.count())
        self.assertEqual(1, second.dependencies.count())

        # remove the dependency
        second.dependency_remove(lib)

        revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
        first = revisions[2]
        second = revisions[1]
        third = revisions[0]

        # only the second revision has the dependencies
        self.assertEqual(0, first.dependencies.count())
        self.assertEqual(1, second.dependencies.count())
        self.assertEqual(0, third.dependencies.count())

    def test_save_with_dependency(self):
        # system should copy on save with all dependencies
        revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
        first = revisions[0]
        lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]

        # make first depends on lib
        # it's setting dependency in django standard way, to keep
        # revision structure
        first.dependencies.add(lib)

        # save creates a new revision
        first.save()
        revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
        first = revisions[1]
        second = revisions[0]
        # both revisions have the same dependencies
        self.assertEqual(first.dependencies.count(),
                         second.dependencies.count())
        self.assertEqual(first.dependencies.all()[0].pk, lib.pk)
        self.assertEqual(second.dependencies.all()[0].pk, lib.pk)

    def test_adding_addon_as_dependency(self):
        " Add-on can't be a dependency "
        lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]
        addon = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
        self.assertRaises(TypeError, lib.dependency_add, addon)
        self.assertEqual(0, lib.dependencies.all().count())

    def test_adding_library_twice(self):
        " Check recurrent dependency (one level only) "
        lib = self.library.latest
        addon = self.addon.latest
        addon.dependency_add(lib)
        self.assertRaises(DependencyException, addon.dependency_add, lib)

    def test_adding_library_self(self):
        " Check recurrent dependency (one level only) "
        lib = self.library.latest
        self.assertRaises(SelfDependencyException, lib.dependency_add, lib)

    def test_removing_not_existing_dependency(self):
        " Removing not existing dependency should raise an error "
        self.assertRaises(DependencyException,
                          self.addon.latest.dependency_remove_by_id_number,
                          self.library.id_number)
        self.assertRaises(DependencyException,
                         self.addon.latest.dependency_remove,
                         self.library.latest)

    def test_adding_module(self):
        " Test if module is added properly "
        addon = Package(author=self.author, type='a')
        addon.save()
        first = addon.latest
        # add module
        first.module_create(
            filename='test',
            author=self.author
        )

        " module should be added to the latter only "
        revisions = addon.revisions.all()
        first = revisions[1]
        second = revisions[0]

        # all add-ons have a default modules created
        self.assertEqual(1, first.modules.count())
        self.assertEqual(2, second.modules.count())

    def test_adding_attachment(self):
        " Test if attachment is added properly "
        addon = Package(author=self.author, type='a')
        addon.save()
        first = addon.latest
        first.attachment_create(
            filename='test',
            ext='txt',
            path='/tmp/testupload',
            author=self.author
        )

        " module should be added to the latter revision only "
        revisions = addon.revisions.all()
        first = revisions[1]
        second = revisions[0]

        self.assertEqual(0, first.attachments.count())
        self.assertEqual(1, second.attachments.count())

    def test_updating_module(self):
        " Updating module has some additional action "
        addon = Package(author=self.author, type='a')
        addon.save()
        first = addon.latest
        mod = first.module_create(
            filename='test_filename',
            author=self.author
        )
        mod.code = 'test'
        first.module_update(mod)

        # create new revision on module update
        self.assertEqual(3, addon.revisions.count())
        self.assertEqual(2, Module.objects.filter(
            filename='test_filename').count())

        first = addon.revisions.all()[1]
        last = addon.revisions.all()[0]

        self.assertEqual(2, last.modules.count())

    def test_adding_module_with_existing_filename(self):
        " filename is unique in package "
        first = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
        first.module_create(
            filename='test_filename',
            author=self.author
        )
        # Exception on creating the module from PackageRevision
        self.assertRaises(FilenameExistException, first.module_create,
            **{'filename': 'test_filename', 'author': self.author}
        )
        # Exception on adding a different module with the same filename
        mod = Module.objects.create(
            filename='test_filename',
            author=self.author
        )
        self.assertRaises(FilenameExistException, first.module_add, mod)

    def test_adding_attachment_with_existing_filename(self):
        " filname is unique per packagerevision "
        first = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
        first.attachment_create(
            filename='test_filename',
            ext='.txt',
            path='/tmp/upload_path',
            author=self.author
        )
        self.assertRaises(FilenameExistException, first.attachment_create,
            **{'filename': 'test_filename',
               'ext': '.txt',
               'author': self.author,
               'path': '/tmp/upload_path'}
        )

        att = Attachment.objects.create(
            filename='test_filename',
            ext='.txt',
            path='/tmp/upload_path',
            author=self.author
        )
        self.assertRaises(FilenameExistException, first.attachment_add, att)

    """
    Althought not supported on view and front-en, there is no harm in these two

    def test_adding_module_which_was_added_to_other_package_before(self):
        " ""
        system should prevent from adding a module to more than one packages
        " ""
        addon = Package.objects.create(
            full_name="Other Package",
            author=self.author,
            type='a'
        )
        rev = addon.latest
        first = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
        mod = Module.objects.create(
            filename='test_filename',
            author=self.author
        )
        first.module_add(mod)
        self.assertRaises(AddingModuleDenied, rev.module_add, mod)

    def test_adding_attachment_which_was_added_to_other_package_before(self):
        " assigning attachment to more than one packages should be prevented! "
        addon = Package.objects.create(
            full_name="Other Package",
            author=self.author,
            type='a'
        )
        rev = addon.latest
        first = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
        att = Attachment.objects.create(
            filename='test_filename',
            ext='.txt',
            path='/tmp/upload_path',
            author=self.author
        )
        first.attachment_add(att)
        self.assertRaises(AddingAttachmentDenied, rev.attachment_add, att)
    """
