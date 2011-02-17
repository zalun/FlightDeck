"""Models definition for jetpack application."""

# TODO: split module and create the models package

import os
import csv
import shutil
import time
import commonware
import tarfile
import markdown

from copy import deepcopy

from ecdsa import SigningKey, NIST256p
from cuddlefish.preflight import vk_to_jid, jid_to_programid, my_b32encode

from django.core.exceptions import ObjectDoesNotExist
from django.db.models.signals import pre_save, post_save, m2m_changed
from django.db import models, IntegrityError
from django.utils import simplejson
from django.utils.html import escape
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.template.defaultfilters import slugify
from django.conf import settings

from api.helpers import export_docs
from utils.exceptions import SimpleException
from jetpack.managers import PackageManager
from jetpack.errors import SelfDependencyException, FilenameExistException, \
        UpdateDeniedException, SingletonCopyException, DependencyException
#        ManifestNotValid

from base.models import BaseModel
from jetpack import tasks
from xpi import xpi_utils
from utils.os_utils import make_path
from utils.helpers import pathify, alphanum

log = commonware.log.getLogger('f.jetpack')


PERMISSION_CHOICES = (
    (0, 'private'),
    (1, 'view'),
    (2, 'do not copy'),
    (3, 'edit')
)
TYPE_CHOICES = (
    ('l', 'Library'),
    ('a', 'Add-on')
)

class Package(BaseModel):
    """
    Holds the meta data shared across all PackageRevisions
    """
    # identification
    # it can be the same as database id, but if we want to copy the database
    # some day or change to a document-oriented database it would be bad
    # to have this relied on any database model
    id_number = models.CharField(max_length=255, unique=True, blank=True)

    # name of the Package
    full_name = models.CharField(max_length=255, blank=True)
    # made from the full_name
    # it is used to create Package directory for export
    name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    # type - determining ability to specific options
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)

    # author is the first person who created the Package
    author = models.ForeignKey(User, related_name='packages_originated')

    # is the Package visible for public?
    public_permission = models.IntegerField(
                                    choices=PERMISSION_CHOICES,
                                    default=1, blank=True)

    # url for the Manifest
    url = models.URLField(verify_exists=False, blank=True, default='')

    # license on which this package is released to the public
    license = models.CharField(max_length=255, blank=True, default='')

    # where to export modules
    lib_dir = models.CharField(max_length=100, blank=True, null=True)

    # this is set in the PackageRevision.set_version
    version_name = models.CharField(max_length=250, blank=True, null=True,
                                    default=settings.INITIAL_VERSION_NAME)

    # Revision which is setting the version name
    version = models.ForeignKey('PackageRevision', blank=True, null=True,
                                related_name='package_deprecated')

    # latest saved PackageRevision
    latest = models.ForeignKey('PackageRevision', blank=True, null=True,
                               related_name='package_deprecated2')

    # signing an add-on
    private_key = models.TextField(blank=True, null=True)
    public_key = models.TextField(blank=True, null=True)
    jid = models.CharField(max_length=255, blank=True, null=True)
    program_id = models.CharField(max_length=255, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_update = models.DateTimeField(auto_now=True)

    # active do not show the package to others
    active = models.BooleanField(default=True, blank=True)

    class Meta:
        " Set the ordering of objects "
        ordering = ('-last_update', '-created_at')
        unique_together = ('author', 'name')

    objects = PackageManager()

    ##################
    # Methods

    def __unicode__(self):
        return '%s v. %s by %s' % (self.full_name, self.version_name,
                                   self.author)

    def get_absolute_url(self):
        " returns the URL View Source "
        return reverse('jp_%s_details' % self.get_type_name(),
                        args=[self.id_number])

    def get_latest_url(self):
        " returns the URL to view the latest saved Revision "
        return reverse('jp_%s_latest' % self.get_type_name(),
                        args=[self.id_number])

    def get_latest_revision_number_url(self):
        " returns url to get the latest revision number "
        return reverse('jp_get_latest_revision_number', args=[self.id_number])

    def get_disable_url(self):
        " returns URL to the disable package functionality "
        return reverse('jp_package_disable',
                        args=[self.id_number])

    def get_activate_url(self):
        " returns URL to activate disabled package "
        return reverse('jp_package_activate',
                        args=[self.id_number])

    def is_addon(self):
        " returns Boolean: True if this package an Add-on "
        return self.type == 'a'

    def is_library(self):
        " returns Boolean: True if this package a Library "
        return self.type == 'l'

    def is_core(self):
        """
        returns Boolean: True if this is a SDK Core Library
        Used to block copying the package
        """
        return str(self.id_number) == str(settings.MINIMUM_PACKAGE_ID)

    def is_singleton(self):
        """
        Blocks copying the package
        """
        # Core lib is a singleton
        return self.is_core()

    def get_type_name(self):
        " return name of the type (add-on / library) "
        return settings.PACKAGE_SINGULAR_NAMES[self.type]

    def get_lib_dir(self):
        " returns the name of the lib directory in SDK default - packages "
        return self.lib_dir or settings.JETPACK_LIB_DIR

    def get_data_dir(self):
        " returns the name of the data directory in SDK default - data "
        # it stays as method as it could be saved in instance in the future
        # TODO: YAGNI!
        return settings.JETPACK_DATA_DIR
    
    def default_full_name(self):
        self.set_full_name()

    def set_full_name(self):
        """
        setting automated full name of the Package item
        add incrementing number in brackets if author already has
        a package with default name
        called from signals
        """
        if self.full_name:
            return

        def _get_full_name(full_name, username, type_id, i=0):
            """
            increment until there is no package with the full_name
            """
            new_full_name = full_name
            if i > 0:
                new_full_name = "%s (%d)" % (full_name, i)
            packages = Package.objects.filter(author__username=username,
                                              full_name=new_full_name,
                                              type=type_id)
            if packages.count() == 0:
                return new_full_name

            i = i + 1
            return _get_full_name(full_name, username, type_id, i)

        username = self.author.username
        if self.author.get_profile():
            username = self.author.get_profile().nickname or username

        name = settings.DEFAULT_PACKAGE_FULLNAME.get(self.type, username)
        self.full_name = _get_full_name(name, self.author.username, self.type)
    
    def default_name(self):
        self.set_name();

    def set_name(self):
        " set's the name from full_name "
        self.name = self.make_name()

    def make_name(self):
        " wrap for slugify - this function was changed before "
        return slugify(self.full_name)

    def generate_key(self):
        """
        create keypair, program_id and jid
        """

        signingkey = SigningKey.generate(curve=NIST256p)
        sk_text = "private-jid0-%s" % my_b32encode(signingkey.to_string())
        verifyingkey = signingkey.get_verifying_key()
        vk_text = "public-jid0-%s" % my_b32encode(verifyingkey.to_string())
        self.jid = vk_to_jid(verifyingkey)
        self.program_id = jid_to_programid(self.jid)
        self.private_key = sk_text
        self.public_key = vk_text

    def make_dir(self, packages_dir):
        """
        create package directories inside packages
        return package directory name
        """
        package_dir = '%s/%s' % (packages_dir, self.name)
        os.mkdir(package_dir)
        os.mkdir('%s/%s' % (package_dir, self.get_lib_dir()))
        if not os.path.isdir('%s/%s' % (package_dir, self.get_data_dir())):
            os.mkdir('%s/%s' % (package_dir, self.get_data_dir()))
        return package_dir

    def get_copied_full_name(self):
        """
        Add "Copy of" before the full name if package is copied
        """
        full_name = self.full_name
        if not full_name.startswith('Copy of'):
            full_name = "Copy of %s" % full_name
        return full_name

    def copy(self, author):
        """
        create copy of the package
        """
        if self.is_singleton():
            raise SingletonCopyException("This is a singleton")
        new_p = Package(
            full_name=self.get_copied_full_name(),
            description=self.description,
            type=self.type,
            author=author,
            public_permission=self.public_permission,
            url=self.url,
            license=self.license,
            lib_dir=self.lib_dir
        )
        new_p.save()
        return new_p

    def create_revision_from_xpi(self, packed, manifest, author, jid,
            new_revision=False):
        """
        Create new package revision by reading XPI

        Args:
            packed (ZipFile): XPI
            manifest (dict): parsed package.json
            jid (String): jid name from XPI
            author (auth.User): owner of PackageRevision
            new_revision (Boolean): should new revision be created?

        Returns:
            PackageRevision object
        """

        revision = self.latest
        if 'contributors' in manifest:
            revision.contributors = manifest['contributors']

        main = manifest['main'] if 'main' in manifest else 'main'
        lib_dir = 'resources/%s-%s-%s' % (jid.lower(), manifest['name'],
                manifest['lib'] if 'lib' in manifest else 'lib')
        att_dir = 'resources/%s-%s-%s' % (
                jid.lower(), manifest['name'], 'data')

        revision.add_mods_and_atts_from_archive(packed, main, lib_dir, att_dir)

        if new_revision:
            revision.save()
        else:
            super(PackageRevision, revision).save()

        revision.set_version(manifest['version'])
        return revision

    def create_revision_from_archive(self, packed, manifest, author,
            new_revision=False):
        """
        Create new package revision vy reading the archive.

        Args:
            packed (ZipFile): archive containing Revision data
            manifest (dict): parsed package.json
            author (auth.User): owner of PackageRevision
            new_revision (Boolean): should new revision be created?

        Returns:
            PackageRevision object
        """

        revision = self.latest
        if 'contributors' in manifest:
            revision.contributors = manifest['contributors']

        main = manifest['main'] if 'main' in manifest else 'main'
        lib_dir = manifest['lib'] if 'lib' in manifest else 'lib'
        att_dir = 'data'

        revision.add_mods_and_atts_from_archive(packed, main, lib_dir, att_dir)

        if new_revision:
            revision.save()
        else:
            super(PackageRevision, revision).save()

        revision.set_version(manifest['version'])
        return revision


class PackageRevision(BaseModel):
    """
    contains data which may be changed and rolled back
    """
    package = models.ForeignKey(Package, related_name='revisions')
    # public version name
    # this is a tag used to mark important revisions
    version_name = models.CharField(max_length=250, blank=True, null=True,
                                    default=settings.INITIAL_VERSION_NAME)
    # this makes the revision unique across the same package/user
    revision_number = models.IntegerField(blank=True, default=0)
    # commit message
    message = models.TextField(blank=True)

    # Libraries on which current package depends
    dependencies = models.ManyToManyField('self', blank=True, null=True,
                                            symmetrical=False)

    # from which revision this mutation was originated
    origin = models.ForeignKey('PackageRevision', related_name='mutations',
                                blank=True, null=True)

    # person who owns this revision
    author = models.ForeignKey(User, related_name='package_revisions')

    created_at = models.DateTimeField(auto_now_add=True)

    contributors = models.CharField(max_length=255, blank=True, default='')

    # main for the Manifest
    module_main = models.CharField(max_length=100, blank=True, default='main')

    # SDK which should be used to create the XPI
    sdk = models.ForeignKey('SDK', blank=True, null=True)

    class Meta:
        " PackageRevision ordering and uniqueness "
        ordering = ('-revision_number',)
        unique_together = ('package', 'author', 'revision_number')

    def __unicode__(self):
        version = 'v. %s ' % self.version_name if self.version_name else ''
        return '%s - %s %sr. %d by %s' % (
                            settings.PACKAGE_SINGULAR_NAMES[self.package.type],
                            self.package.full_name, version,
                            self.revision_number, self.author.get_profile()
                            )

    def get_absolute_url(self):
        " returns URL to view the package revision "
        if self.version_name:
            if self.package.version.revision_number == self.revision_number:
                return self.package.get_absolute_url()
            return reverse(
                'jp_%s_version_details' \
                % settings.PACKAGE_SINGULAR_NAMES[self.package.type],
                args=[self.package.id_number, self.version_name])
        return reverse(
            'jp_%s_revision_details' \
            % settings.PACKAGE_SINGULAR_NAMES[self.package.type],
            args=[self.package.id_number, self.revision_number])

    def get_save_url(self):
        " returns URL to save the package revision "
        return reverse(
            'jp_%s_revision_save' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_add_module_url(self):
        " returns URL to add module to the package revision "
        return reverse(
            'jp_%s_revision_add_module' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_rename_module_url(self):
        " returns URL to rename module in the package revision "
        return reverse(
            'jp_%s_revision_rename_module' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_remove_module_url(self):
        " returns URL to remove module from the package revision "
        return reverse(
            'jp_%s_revision_remove_module' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_add_attachment_url(self):
        " returns URL to add attachment to the package revision "
        return reverse(
            'jp_%s_revision_add_attachment' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_rename_attachment_url(self):
        " returns URL to rename module in the package revision "
        return reverse(
            'jp_%s_revision_rename_attachment' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_remove_attachment_url(self):
        " returns URL to remove attachment from the package revision "
        return reverse(
            'jp_%s_revision_remove_attachment' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_assign_library_url(self):
        " returns url to assign library to the package revision "
        return reverse(
            'jp_%s_revision_assign_library' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_remove_library_url(self):
        " returns url to remove library from the package revision "
        return reverse(
            'jp_%s_revision_remove_library' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_test_xpi_url(self):
        " returns URL to test Add-on "
        if self.package.type != 'a':
            raise Exception('XPI might be created only from an Add-on')
        return reverse(
            'jp_addon_revision_test',
            args=[self.package.id_number, self.revision_number])

    def get_download_xpi_url(self):
        " returns URL to download Add-on's XPI "
        if self.package.type != 'a':
            raise Exception('XPI might be created only from an Add-on')
        return reverse(
            'jp_addon_revision_xpi',
            args=[self.package.id_number, self.revision_number])

    def get_copy_url(self):
        " returns URL to copy the package "
        return reverse(
            'jp_%s_revision_copy' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_switch_sdk_url(self):
        " returns URL to switch SDK on the package revision "
        return reverse(
            'jp_addon_switch_sdk_version',
            args=[self.package.id_number, self.revision_number])

    def get_add_folder_url(self):
        return reverse(
            'jp_%s_revision_add_folder' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    def get_remove_folder_url(self):
        return reverse(
            'jp_%s_revision_remove_folder' % self.package.get_type_name(),
            args=[self.package.id_number, self.revision_number])

    ######################
    # Manifest

    def get_contributors_list(self):
        " returns a CSV build from the list of contributors "
        csv_r = csv.reader([self.contributors], skipinitialspace=True)
        for contributors in csv_r:
            return contributors

    def get_dependencies_list(self, sdk=None):
        " returns a list of dependencies names extended by default core "
        if self.package.is_addon() and self.sdk.kit_lib:
            deps = ['addon-kit']
        else:
            if sdk and sdk.kit_lib:
                deps = ['api-utils']
            else:
            # jetpack-core or api-utils
                deps = ['jetpack-core']
        deps.extend([dep.package.name \
                     for dep in self.dependencies.all()])
        return deps

    def get_full_description(self):
        " return joined package and its revision description "
        description = self.package.description
        if self.message:
            description = "%s\n%s" % (description, self.message)
        return description

    def get_full_rendered_description(self):
        " return description prepared for rendering "
        return "<p>%s</p>" % self.get_full_description().replace("\n", "<br/>")

    def get_manifest(self, test_in_browser=False, sdk=None):
        " returns manifest dictionary "
        version = self.get_version_name()
        if test_in_browser:
            version = "%s - test" % version

        manifest = {
            'fullName': self.package.full_name,
            'name': self.package.name,
            'description': self.get_full_description(),
            'author': self.package.author.username,
            'id': self.package.jid if self.package.is_addon() \
                    else self.package.id_number,
            'version': version,
            'dependencies': self.get_dependencies_list(sdk),
            'license': self.package.license,
            'url': str(self.package.url),
            'contributors': self.get_contributors_list(),
            'lib': self.package.get_lib_dir()
        }
        if self.package.is_addon():
            manifest['main'] = self.module_main

        return manifest

    def get_manifest_json(self, sdk=sdk, **kwargs):
        " returns manifest as JSOIN object "
        return simplejson.dumps(self.get_manifest(sdk=sdk, **kwargs))

    def get_main_module(self):
        " return executable Module for Add-ons "
        if self.package.type == 'l':
            return None

        # find main module
        main = self.modules.filter(filename=self.module_main)
        if not main:
            raise Exception(
                'Every Add-on needs to be linked with an executable Module')
        return main[0]

    ######################
    # revision save methods

    def save(self, **kwargs):
        """
        overloading save is needed to prevent from updating the same revision
        use super(PackageRevision, self).save(**kwargs) if needed
        """
        if self.id:
            # create new revision
            return self.save_new_revision(**kwargs)
        return super(PackageRevision, self).save(**kwargs)

    def save_new_revision(self, package=None, **kwargs):
        " save self as new revision with link to the origin. "
        origin = deepcopy(self)
        if package:
            self.package = package
            self.author = package.author
        # reset instance - force saving a new one
        self.id = None
        self.version_name = None
        self.origin = origin
        self.revision_number = self.get_next_revision_number()

        save_return = super(PackageRevision, self).save(**kwargs)
        # reassign all dependencies
        for dep in origin.dependencies.all():
            self.dependencies.add(dep)

        for dir in origin.folders.all():
            self.folders.add(dir)

        for mod in origin.modules.all():
            self.modules.add(mod)

        for att in origin.attachments.all():
            self.attachments.add(att)


        self.package.latest = self
        self.package.save()
        if package:
            self.set_version('copy')
        return save_return

    def get_next_revision_number(self):
        """
        find latest revision_number for the self.package and self.user
        @return latest revisiion number or 1
        """
        revision_numbers = PackageRevision.objects.filter(
                                    author__username=self.author.username,
                                    package__id_number=self.package.id_number
                                ).order_by('-revision_number')
        return revision_numbers[0].revision_number + 1 \
                if revision_numbers else 1

    def set_version(self, version_name, current=True):
        """
        @param String version_name: name of the version
        @param Boolean current: should the version become a current one
        @returns result of save revision

        Set the version_name
        update the PackageRevision obeying the overload save
        Set current Package:version_name and Package:version if current
        """
        # check if there isn't a version with such a name
        if PackageRevision.objects.filter(package__pk=self.package.pk,
                version_name=version_name).count() > 0:
            # reset version_name
            version_name = ''
        self.version_name = version_name
        if current and version_name:
            self.package.version_name = version_name
            self.package.version = self
            self.package.save()

        return super(PackageRevision, self).save()

    def validate_module_filename(self, filename):
        """
        returns False if the package revision contains a module with given
        filename
        """
        if self.modules.filter(filename=filename).count():
            return False
        return True

    def validate_attachment_filename(self, filename, ext):
        """
        returns False if the package revision contains a module with given
        filename
        """
        if self.attachments.filter(filename=filename, ext=ext).count():
            return False
        return True

    def validate_folder_name(self, foldername, root_dir):
        if self.folders.filter(name=foldername, root_dir=root_dir).count():
            return False
        return True

    def module_create(self, save=True, **kwargs):
        " create module and add to modules "
        # validate if given filename is valid
        if not self.validate_module_filename(kwargs['filename']):
            raise FilenameExistException(
                ('Sorry, there is already a module in your add-on'
                 'with the name "%s". Each module in your add-on'
                 'needs to have a unique name.') % kwargs['filename']
            )
        mod = Module.objects.create(**kwargs)
        self.module_add(mod, save=save)
        return mod

    def module_add(self, mod, save=True):
        " copy to new revision, add module "
        # validate if given filename is valid
        if not self.validate_module_filename(mod.filename):
            raise FilenameExistException(
                ('Sorry, there is already a module in your add-on '
                 'with the name "%s". Each module in your add-on '
                 'needs to have a unique name.') % mod.filename
            )

        if save:
            self.save()
        return self.modules.add(mod)

    def module_remove(self, *mods):
        " copy to new revision, remove module(s) "
        self.save()
        return self.modules.remove(*mods)

    def modules_remove_by_path(self, filenames):

        found_modules = []
        module_found = False
        empty_dirs_paths = []

        for filename in filenames:
            if filename[-1] == '/':
                empty_dirs_paths.append(filename[:-1])
                modules = self.modules.filter(filename__startswith=filename)
            else:
                modules = self.modules.filter(filename=filename)
            if modules.count() > 0:
                for mod in modules:
                    found_modules.append(mod)
                    module_found = True

        if not module_found:
            raise Module.DoesNotExist

        self.save()
        self.modules.remove(*found_modules)

        log.warning(self.folders.all())
        for path in empty_dirs_paths:
            folder = self.folders.get(root_dir='l', name=path)
            self.folders.remove(folder)
        return ([mod.filename for mod in found_modules], empty_dirs_paths)

    def folder_add(self, dir, save=True):
        " copy to new revision, add EmptyDir "
        errorMsg = ('Sorry, there is already a folder in your add-on '
                 'with the name "%s". Each folder in your add-on '
                 'needs to have a unique name.') % dir.name

        if not self.validate_folder_name(dir.name, dir.root_dir):
            raise FilenameExistException(errorMsg)

        # don't make EmptyDir for util/ if a file exists as util/example
        elif (dir.root_dir == 'l' and
            self.modules.filter(filename__startswith=dir.name).count()):
            raise FilenameExistException(errorMsg)
        elif (dir.root_dir == 'd' and
            self.attachments.filter(filename__startswith=dir.name).count()):
            raise FilenameExistException(errorMsg)

        if save:
            self.save()
        return self.folders.add(dir)

    def folder_remove(self, dir):
        " copy to new revision, remove folder "
        self.save()
        return self.folders.remove(dir)

    def update(self, change, save=True):
        " to update a module, new package revision has to be created "
        if save:
            self.save()

        change.increment(self)

    def updates(self, changes):
        """Changes from the server."""
        self.save()
        for change in changes:
            self.update(change, False)

    def add_mods_and_atts_from_archive(self, packed, main, lib_dir, att_dir):
        """
        Read packed archive and search for modules and attachments
        """
        for path in packed.namelist():
            # add Modules
            if path.startswith(lib_dir):
                module_path = path.split('%s/' % lib_dir)[1]
                if module_path and not module_path.endswith('/'):
                    module_path = os.path.splitext(module_path)[0]
                    code = packed.read(path)
                    if module_path in [m.filename for m in self.modules.all()]:
                        mod = self.modules.get(filename=module_path)
                        mod.code = code
                        self.update(mod, save=False)
                    else:
                        self.module_create(
                                save=False,
                                filename=module_path,
                                author=self.author,
                                code=code)

            # add Attachments
            if path.startswith(att_dir):
                att_path = path.split('%s/' % att_dir)[1]
                if att_path and not att_path.endswith('/'):
                    code = packed.read(path)
                    filename, ext = os.path.splitext(att_path)
                    if ext.startswith('.'):
                        ext = ext.split('.')[1]

                    if (filename, ext) in [(a.filename, a.ext)
                            for a in self.attachments.all()]:
                        att = self.attachments.get(filename=filename, ext=ext)
                        att.data = code
                        self.update(att, save=False)
                    else:
                        att = self.attachment_create(
                                save=False,
                                filename=filename,
                                ext=ext,
                                path='temp',
                                author=self.author)
                        att.data = code
                        att.write()
                        self.attachments.add(att)

    def attachment_create_by_filename(self, author, filename):
        """ find out the filename and ext and call attachment_create """
        filename, ext = os.path.splitext(filename)
        ext = ext.split('.')[1].lower() if ext else None
        
        kwargs = {
            'author': author,
            'filename': filename
        }
        
        if ext:
            kwargs['ext'] = ext

        return self.attachment_create(**kwargs)

    def attachment_create(self, save=True, **kwargs):
        """ create attachment and add to attachments """
        filename, ext = kwargs['filename'], kwargs.get('ext', '')

        if not self.validate_attachment_filename(filename, ext):
            raise FilenameExistException(
                ('Sorry, there is already an attachment in your add-on with '
                 'the name "%s.%s". Each attachment in your add-on needs to '
                 'have a unique name.') % (filename, ext)
            )
        att = Attachment.objects.create(**kwargs)
        self.attachment_add(att, save=save)
        return att

    def attachment_add(self, att, check=True, save=True):
        " copy to new revision, add attachment "
        # save as new version
        # validate if given filename is valid
        if (check and
            not self.validate_attachment_filename(att.filename, att.ext)):
            raise FilenameExistException(
                'Attachment with filename %s.%s already exists' % (
                    att.filename, att.ext)
            )

        if save:
            self.save()
        return self.attachments.add(att)

    def attachment_remove(self, dep):
        " copy to new revision, remove attachment "
        # save as new version
        self.save()
        return self.attachments.remove(dep)

    def dependency_add(self, dep, save=True):
        """
        copy to new revision,
        add dependency (existing Library - PackageVersion)
        """
        # a PackageRevision has to depend on the LibraryRevision only
        if dep.package.type != 'l':
            raise TypeError('Dependency has to be a Library')

        # a LibraryRevision can't depend on another LibraryRevision
        # linked with the same Library
        if dep.package.id_number == self.package.id_number:
            raise SelfDependencyException(
                'A Library can not depend on itself!')

        # dependency have to be unique in the PackageRevision
        if self.dependencies.filter(
                package__name=dep.package.name).count() > 0:
            raise DependencyException(
                'Your add-on already depends on "%s" by %s.' % (
                    dep.package.full_name,
                    dep.package.author.get_profile()))
        if save:
            # save as new version
            self.save()
        return self.dependencies.add(dep)

    def dependency_remove(self, dep):
        " copy to new revision, remove dependency "
        if self.dependencies.filter(pk=dep.pk).count() > 0:
            # save as new version
            self.save()
            return self.dependencies.remove(dep)
        raise DependencyException(
            'There is no such library in this %s' \
            % self.package.get_type_name())

    def dependency_remove_by_id_number(self, id_number):
        " find dependency by its id_number call dependency_remove "
        for dep in self.dependencies.all():
            if dep.package.id_number == id_number:
                self.dependency_remove(dep)
                return True
        raise DependencyException(
            'There is no such library in this %s' \
            % self.package.get_type_name())

    def get_dependencies_list_json(self):
        " returns dependencies list as JSON object "
        d_list = [{
                'full_name': escape(d.package.full_name),
                'view_url': d.get_absolute_url()
                } for d in self.dependencies.all()
            ] if self.dependencies.count() > 0 else []
        return simplejson.dumps(d_list)

    def get_modules_list_json(self):
        " returns modules list as JSON object "
        m_list = [{
                'filename': escape(m.filename),
                'author': escape(m.author.username),
                'executable': self.module_main == m.filename,
                'get_url': reverse('jp_module', args=[m.pk])
                } for m in self.modules.all()
            ] if self.modules.count() > 0 else []
        return simplejson.dumps(m_list)

    def get_attachments_list_json(self):
        " returns attachments list as JSON object "
        a_list = [{
                'uid': a.get_uid,
                'filename': escape(a.filename),
                'author': escape(a.author.username),
                'type': escape(a.ext),
                'get_url': reverse('jp_attachment', args=[a.get_uid])
                } for a in self.attachments.all()
            ] if self.attachments.count() > 0 else []
        return simplejson.dumps(a_list)

    def get_folders_list_json(self):
        " returns empty folders list as JSON object "
        f_list = [{
                'name': escape(f.name),
                'author': escape(f.author.username),
                'root_dir': escape(f.root_dir),
                } for f in self.folders.all()
            ] if self.folders.count() > 0 else []
        return simplejson.dumps(f_list)

    def get_modules_tree(self):
        " returns modules list as JSON object "
        return [{
                'path': m.filename,
                'get_url': reverse('jp_get_module', args=[
                    self.package.id_number,
                    self.revision_number,
                    m.filename])
                } for m in self.modules.all()
            ] if self.modules.count() > 0 else []

    def get_attachments_tree(self):
        " returns modules list as JSON object "
        return [{
                'path': a.filename,
                'get_url': a.get_display_url()
                } for a in self.attachments.all()
            ] if self.attachments.count() > 0 else []

    def get_dependencies_tree(self):
        " returns libraries "
        _lib_dict = lambda lib: {'path': lib.package.full_name,
                                 'url': lib.get_absolute_url()}

        libs = [_lib_dict(self.get_sdk_revision())] \
                if self.get_sdk_revision() else []
        if self.dependencies.count() > 0:
            libs.extend([_lib_dict(lib) for lib in self.dependencies.all()])
        return libs

    def get_sdk_name(self):
        " returns the name of the directory to which SDK should be copied "
        return '%s-%s-%s' % (self.sdk.version,
                             self.package.id_number, self.revision_number)

    def get_sdk_dir(self, hashtag):
        " returns the path to the directory where the SDK should be copied "
        return os.path.join(
                settings.SDKDIR_PREFIX,
                "%s-%s" % (hashtag, self.get_sdk_name()))

    def get_sdk_revision(self):
        " return core_lib, addon_kit or None "
        if not self.sdk:
            return None

        return self.sdk.kit_lib if self.sdk.kit_lib else self.sdk.core_lib

    def build_xpi(self, modules=[], attachments=[], hashtag=None, rapid=False):
        """
        prepare and build XPI for test only (unsaved modules)

        :param modules: list of modules from editor - potentially unsaved
        :param rapid: if True - do not use celery to produce xpi
        :rtype: dict containing load xpi information if rapid else AsyncResult
        """
        if self.package.type == 'l':
            raise Exception('only Add-ons may build a XPI')

        if not hashtag:
            raise IntegrityError('hashtag is required to create xpi')

        sdk_dir = self.get_sdk_dir(hashtag)
        sdk_source = self.sdk.get_source_dir()
        # This SDK is always different! - working on unsaved data
        if os.path.isdir(sdk_dir):
            shutil.rmtree(sdk_dir)
        xpi_utils.sdk_copy(sdk_source, sdk_dir)
        self.export_keys(sdk_dir)

        packages_dir = '%s/packages' % sdk_dir
        package_dir = self.package.make_dir(packages_dir)
        self.export_manifest(package_dir)
        # instead of export modules
        lib_dir = '%s/%s' % (package_dir, self.package.get_lib_dir())
        for mod in self.modules.all():
            mod_edited = False
            for e_mod in modules:
                if e_mod.pk == mod.pk:
                    mod_edited = True
                    e_mod.export_code(lib_dir)
            if not mod_edited:
                mod.export_code(lib_dir)
        data_dir = os.path.join(package_dir, self.package.get_data_dir())
        for att in self.attachments.all():
            att_edited = False
            for e_att in attachments:
                if e_att.pk == att.pk:
                    att_edited = True
                    e_att.export_code(data_dir)
            if not att_edited:
                att.export_file(data_dir)
        #self.export_attachments(
        #    '%s/%s' % (package_dir, self.package.get_data_dir()))
        self.export_dependencies(packages_dir, sdk=self.sdk)

        args = [sdk_dir, '%s/packages/%s' % (sdk_dir, self.package.name),
                self.package.name, hashtag]
        if rapid:
            return xpi_utils.build(*args)

        return (tasks.xpi_build.delay(*args),
                reverse('jp_rm_xpi', args=[hashtag]))

    def export_keys(self, sdk_dir):
        " export private and public keys "
        keydir = '%s/%s' % (sdk_dir, settings.KEYDIR)
        if not os.path.isdir(keydir):
            os.mkdir(keydir)
        handle = open('%s/%s' % (keydir, self.package.jid), 'w')
        handle.write('private-key:%s\n' % self.package.private_key)
        handle.write('public-key:%s' % self.package.public_key)
        handle.close()

    def export_manifest(self, package_dir, sdk=None):
        " creates a file with an Add-on's manifest "
        handle = open('%s/package.json' % package_dir, 'w')
        handle.write(self.get_manifest_json(sdk=sdk))
        handle.close()

    def export_modules(self, lib_dir):
        " creates module file for each module "
        for mod in self.modules.all():
            mod.export_code(lib_dir)

    def export_attachments(self, data_dir):
        " creates attachment file for each attachment "
        for att in self.attachments.all():
            att.export_file(data_dir)

    def export_dependencies(self, packages_dir, sdk=None):
        " creates dependency package directory for each dependency "
        for lib in self.dependencies.all():
            lib.export_files_with_dependencies(packages_dir, sdk=sdk)

    def export_files(self, packages_dir, sdk=None):
        " calls all export functions - creates all packages files "
        package_dir = self.package.make_dir(packages_dir)
        self.export_manifest(package_dir, sdk=sdk)
        self.export_modules(
            '%s/%s' % (package_dir, self.package.get_lib_dir()))
        self.export_attachments(
            '%s/%s' % (package_dir, self.package.get_data_dir()))

    def export_files_with_dependencies(self, packages_dir, sdk=None):
        " export dependency packages "
        self.export_files(packages_dir, sdk=sdk)
        self.export_dependencies(packages_dir, sdk=sdk)

    def get_version_name(self):
        " returns version name with revision number if needed "

        return self.version_name \
                if self.version_name \
                else "%s.rev%s" % (
                    self.package.revisions.exclude(version_name=None)
                        .filter(revision_number__lt=self.revision_number)[0]
                            .version_name, self.revision_number)


class Module(BaseModel):
    """
    Code used by Package.
    It's assigned to PackageRevision.

    The only way to 'change' the module is to assign it to
    different PackageRevision
    """
    revisions = models.ManyToManyField(PackageRevision,
                                    related_name='modules', blank=True)
    # name of the Module - it will be used as javascript file name
    filename = models.CharField(max_length=255)
    # Code of the module
    code = models.TextField(blank=True)
    # user who has written current revision of the module
    author = models.ForeignKey(User, related_name='module_revisions')

    class Meta:
        " ordering for Module model "
        ordering = ('filename',)

    def __unicode__(self):
        return '%s by %s (%s)' % (self.get_filename(),
                                  self.author, self.get_package_fullName())

    def get_package(self):
        " returns first package to which the module is assigned "
        # TODO: Check if this method is used
        try:
            return self.revisions.all()[0].package
        except Exception:
            return None

    def get_package_fullName(self):
        " returns full name of the package to which the module is assigned "
        # TODO: Check if this method is used
        package = self.get_package()
        return package.full_name if package else ''

    def get_path(self):
        " returns the path of directories that would be created from the filename "
        parts = self.filename.split('/')[0:-1]
        return ('/'.join(parts)) if parts else None

    def get_filename(self):
        " returns the filename with extension (adds .js)"
        return "%s.js" % self.filename

    def save(self, *args, **kwargs):
        " overloaded to prevent from updating an existing module "
        if self.id:
            raise UpdateDeniedException(
                'Module can not be updated in the same row')
        return super(Module, self).save(*args, **kwargs)

    def export_code(self, lib_dir):
        " creates a file containing the module "
        path = os.path.join(lib_dir, '%s.js' % self.filename)
        make_path(os.path.dirname(os.path.abspath(path)))
        handle = open(path, 'w')
        handle.write(self.code)
        handle.close()

    def get_json(self):
        return simplejson.dumps({
            'filename': self.filename,
            'code': self.code,
            'author': self.author.username})

    def increment(self, revision):
        revision.modules.remove(self)
        self.pk = None
        self.save()
        revision.modules.add(self)
    
    def clean(self):
        first_period = self.filename.find('.')
        if first_period > -1:
            self.filename = self.filename[:first_period]


class Attachment(BaseModel):
    """
    File (image, css, etc.) updated by the author of the PackageRevision
    When exported should be placed in a special directory - usually "data"
    """

    revisions = models.ManyToManyField(PackageRevision,
                                    related_name='attachments', blank=True)
    # filename of the attachment
    filename = models.CharField(max_length=255)
    # extension name
    ext = models.CharField(max_length=10, blank=True, default='js')

    # access to the file within upload/ directory
    path = models.CharField(max_length=255)

    # user who has uploaded the file
    author = models.ForeignKey(User, related_name='attachments')
    # mime will help with displaying the attachment
    mimetype = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        " attachment ordering "
        ordering = ('filename', 'id')

    @property
    def get_uid(self):
        """A uid that contains, filename and extension and is suitable
        for use in css selectors (eg: no spaces)."""
        return str(int(self.pk))

    @property
    def is_editable(self):
        return self.ext in ["html", "css", "js", "txt"]

    def get_filename(self):
        " returns human readable filename with extension "
        name = self.filename
        if self.ext:
            name = "%s.%s" % (name, self.ext)
        return name

    def get_path(self):
        " returns the path of directories that would be created from the filename "
        parts = self.filename.split('/')[0:-1]
        return ('/'.join(parts)) if parts else None

    def get_display_url(self):
        """Returns URL to display the attachment."""
        return reverse('jp_attachment', args=[self.get_uid])

    def default_path(self):
        self.create_path()
    
    def create_path(self):
        args = (self.pk, self.filename, self.ext)
        self.path = os.path.join(time.strftime('%Y/%m/%d'), '%s-%s.%s' % args)

    def get_file_path(self):
        if self.path:
            return os.path.join(settings.UPLOAD_DIR, self.path)
        raise ValueError("self.path not set.")

    def read(self):
        """Reads the file, if it doesn't exist return empty."""
        if self.path and os.path.exists(self.get_file_path()):
            return open(self.get_file_path(), 'rb').read()
        return ""

    def changed(self):
        return self.read() != self.data

    def write(self):
        """Writes the file."""

        data = self.data if hasattr(self, 'data') else self.read()
        self.create_path()
        self.save()



        directory = os.path.dirname(self.get_file_path())

        if not os.path.exists(directory):
            os.makedirs(directory)

        handle = open(self.get_file_path(), 'wb')
        handle.write(data)
        handle.close()

    def export_code(self, static_dir):
        " creates a file containing the module "
        if not hasattr(self, 'code'):
            return self.export_file(static_dir)
        path = os.path.join(static_dir, '%s.%s' % (self.filename, self.ext))
        make_path(os.path.dirname(os.path.abspath(path)))
        handle = open(path, 'w')
        handle.write(self.code)
        handle.close()

    def export_file(self, static_dir):
        " copies from uploads to the package's data directory "
        path = os.path.join(static_dir, '%s.%s' % (self.filename, self.ext))
        make_path(os.path.dirname(os.path.abspath(path)))
        shutil.copy(os.path.join(settings.UPLOAD_DIR, self.path),
                    path)

    def increment(self, revision):
        revision.attachments.remove(self)
        self.pk = None
        self.save()
        self.write()
        revision.attachments.add(self)
    
    def clean(self):
        self.filename = pathify(self.filename)
        if self.ext:
            self.ext = alphanum(self.ext)


class EmptyDir(BaseModel):
    revisions = models.ManyToManyField(PackageRevision,
                                       related_name='folders', blank=True)
    name = models.CharField(max_length=255)
    author = models.ForeignKey(User, related_name='folders')

    ROOT_DIR_CHOICES = (
        ('l', settings.JETPACK_LIB_DIR),
        ('d', settings.JETPACK_DATA_DIR),
    )
    root_dir = models.CharField(max_length=10, choices=ROOT_DIR_CHOICES)

    def __unicode__(self):
        return 'Dir: %s (by %s)' % (self.name, self.author.username)

    #def get_root_dir_display(self):
    #    " overriding to get get package lib and data dirs "
    #    return

    def export(self, root_dir):
        pass

class SDK(BaseModel):
    """
    Jetpack SDK representation in database
    Add-ons have to depend on an SDK, by default on the latest one.
    """
    version = models.CharField(max_length=10, unique=True)

    # It has to be accompanied with a core library
    # needs to exist before SDK is created
    core_lib = models.OneToOneField(PackageRevision,
            related_name="parent_sdk_core+")
    kit_lib = models.OneToOneField(PackageRevision,
            related_name="parent_sdk_kit+", blank=True, null=True)
    #core_name = models.CharField(max_length=100, default='jetpack-core')
    #core_fullname = models.CharField(max_length=100, default='Jetpack Core')
    #kit_name = models.CharField(max_length=100, default='addon-kit')
    #kit_fullname = models.CharField(max_length=100, default='Addon Kit')

    # placement in the filesystem
    dir = models.CharField(max_length=255, unique=True)

    class Meta:
        " orderin of SDK instances"
        ordering = ["-id"]

    def __unicode__(self):
        return self.version

    def get_source_dir(self):
        return os.path.join(settings.SDK_SOURCE_DIR, self.dir)

    def is_deprecated(self):
        return self.version < '0.9'

    def import_docs(self, tar_filename="addon-sdk-docs.tgz", export=True):
        from api.models import DocPage
        """import docs from addon-sdk-docs.tgz """
        tar_path = os.path.join(self.get_source_dir(), tar_filename)
        sdk_dir = self.get_source_dir()
        if export:
            if os.path.isfile(tar_path):
                raise SimpleException(
                        "%s does exist. Have you forgotten to remove it?" %
                        tar_path)
            export_docs(sdk_dir)
        if not os.path.isfile(tar_path):
            raise SimpleException(
                    "%s does not exist. It should be here?" %
                    tar_path)
        if not tarfile.is_tarfile(tar_path):
            raise SimpleException("%s is not a tar file" % tar_path)
        # import data
        tar_file = tarfile.open(tar_path)



        for member in tar_file.getmembers():
            if 'addon-sdk-docs/packages/' in member.name:
                # filter package description
                if 'README.md' in member.name:
                    """ consider using description for packages """
                    member_path = member.name.split('/README.md')[0]
                    member_path = member_path.split('addon-sdk-docs/packages/')[1]
                    member_file = tar_file.extractfile(member)
                    try:
                        docpage = DocPage.objects.get(sdk=self, path=member_path)
                    except ObjectDoesNotExist:
                        docpage = DocPage(sdk=self, path=member_path)
                    docpage.html = '<h1>%s</h1>%s' % (
                            member_path,
                            markdown.markdown(member_file.read()))
                    docpage.json = ''
                    docpage.save()
                    member_file.close()
                # filter module description
                if '/docs/' in member.name and '.md' in member.name and '.md.' not in member.name:
                    # strip down to the member_path
                    member_path = member.name.split('.md')[0]
                    member_path = ''.join(member_path.split('/docs'))
                    member_path = member_path.split('addon-sdk-docs/packages/')[1]
                    # extract member_html and member_json
                    try:
                        member_html = tar_file.getmember(member.name + '.div')
                    except KeyError:
                        member_html = tar_file.getmember(
                                member.name + '.div.html')
                    member_html_file = tar_file.extractfile(member_html)
                    member_json = tar_file.getmember(member.name + '.json')
                    member_json_file = tar_file.extractfile(member_json)
                    # create or load docs
                    try:
                        docpage = DocPage.objects.get(sdk=self, path=member_path)
                    except ObjectDoesNotExist:
                        docpage = DocPage(sdk=self, path=member_path)
                    docpage.html = member_html_file.read()
                    docpage.json = member_json_file.read()
                    docpage.save()
                    member_html_file.close()
                    member_json_file.close()

        tar_file.close()
        # remove docs file
        os.remove(tar_path)


def _get_next_id_number():
    """
    get the highest id number and increment it
    """
    all_packages_ids = [int(x.id_number) for x in Package.objects.all()]
    all_packages_ids.sort()
    return str(all_packages_ids[-1] + 1) \
            if all_packages_ids else str(settings.MINIMUM_PACKAGE_ID)


# Catching Signals
def set_package_id_number(instance, **kwargs):
    " sets package's id_number before creating the new one "
    if kwargs.get('raw', False) or instance.id or instance.id_number:
        return
    instance.id_number = _get_next_id_number()
pre_save.connect(set_package_id_number, sender=Package)

def make_keypair_on_create(instance, **kwargs):
    " creates public and private keys for JID "
    if kwargs.get('raw', False) or instance.id or not instance.is_addon():
        return
    instance.generate_key()
pre_save.connect(make_keypair_on_create, sender=Package)


def save_first_revision(instance, **kwargs):
    """
    every Package has at least one PackageRevision - it's created here
    if Package is an Add-on it will create a Module as well.
    """
    if kwargs.get('raw', False) or not kwargs.get('created', False):
        return

    revision = PackageRevision(
        package=instance,
        author=instance.author
    )
    if instance.is_addon():
        sdks = SDK.objects.all()
        if len(sdks):
            revision.sdk = sdks[0]
    revision.save()
    instance.version = revision
    instance.latest = revision
    if instance.is_addon():
        first_module_name = revision.module_main
        first_module_code = """// This is an active module of the %s Add-on
exports.main = function() {};"""
    else:
        first_module_name = 'index'
        first_module_code = "// This is first module of the %s Library"
    mod = Module.objects.create(
        filename=first_module_name,
        author=instance.author,
        code=first_module_code % instance.full_name
    )
    revision.modules.add(mod)
    instance.save()
post_save.connect(save_first_revision, sender=Package)

def manage_empty_lib_dirs(instance, action, **kwargs):
    """
    create EmptyDirs when all modules in a "dir" are deleted,
    and remove EmptyDirs when any modules are added into the "dir"
    """
    if not (isinstance(instance, PackageRevision)
            and action in ('post_add', 'post_remove')):
        return

    pk_set = kwargs.get('pk_set', [])

    if action == 'post_add':
        for pk in pk_set:
            mod = Module.objects.get(pk=pk)
            dirname = mod.get_path()
            if not dirname:
                continue
            for d in instance.folders.filter(name=dirname, root_dir='l'):
                instance.folders.remove(d)

    elif action == 'post_remove':
        for pk in pk_set:
            mod = Module.objects.get(pk=pk)
            dirname = mod.get_path()
            if not dirname:
                continue

            if not instance.modules.filter(filename__startswith=dirname).count():
                emptydir = EmptyDir(name=dirname, author=instance.author, root_dir='l')
                emptydir.save()

                instance.folders.add(emptydir)
m2m_changed.connect(manage_empty_lib_dirs, sender=Module.revisions.through)

def manage_empty_data_dirs(instance, action, **kwargs):
    """
    create EmptyDirs when all modules in a "dir" are deleted,
    and remove EmptyDirs when any modules are added into the "dir"
    """
    if not (isinstance(instance, PackageRevision)
            and action in ('post_add', 'post_remove')):
        return

    pk_set = kwargs.get('pk_set', [])

    if action == 'post_add':
        for pk in pk_set:
            att = Attachment.objects.get(pk=pk)
            dirname = att.get_path()
            if not dirname:
                continue
            for d in instance.folders.filter(name=dirname, root_dir='d'):
                instance.folders.remove(d)

    elif action == 'post_remove':
        for pk in pk_set:
            att = Attachment.objects.get(pk=pk)
            dirname = att.get_path()
            if not dirname:
                continue

            if not instance.attachments.filter(filename__startswith=dirname).count():
                emptydir = EmptyDir(name=dirname, author=instance.author, root_dir='d')
                emptydir.save()

                instance.folders.add(emptydir)
m2m_changed.connect(manage_empty_data_dirs, sender=Attachment.revisions.through)
