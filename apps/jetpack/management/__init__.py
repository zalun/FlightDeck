" Predefined for all Jetpack commands "
import commonware.log
import os
import simplejson
import shutil

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings

from jetpack.models import Package, PackageRevision, SDK
from person.models import Profile
from utils.exceptions import SimpleException

log = commonware.log.getLogger('f.importsdk')


ALLOWED_CORE_NAMES = {
    'jetpack-core': 'Jetpack Core',
    'api-utils': 'API Utils'
}


class SDKVersionNotUniqueException(SimpleException):
    " Not unique version of SDK "


class SDKDirNotUniqueException(SimpleException):
    " There is already a SDK build from that directory "


class SDKDirDoesNotExist(SimpleException):
    " No such dir "


def get_manifest(sdk_source, core_name):
    " parse the SDK's manifest "
    if not os.path.isdir(sdk_source):
        raise SDKDirDoesNotExist(
            "Jetpack SDK dir does not exist \"%s\"" % sdk_source)

    manifest_file = '%s/packages/%s/package.json' % (sdk_source, core_name)
    if (not os.path.isfile(manifest_file)):
        return None
    handle = open(manifest_file)
    manifest = simplejson.loads(handle.read())
    handle.close()
    return manifest


def get_core_manifest(sdk_source):
    " parse allowed names of core lib "
    core_manifest = None
    core_name = None
    core_fullname = None
    for core_n in ALLOWED_CORE_NAMES.keys():
        if not core_manifest:
            core_manifest = get_manifest(sdk_source, core_n)
            if core_manifest:
                core_fullname = ALLOWED_CORE_NAMES[core_n]
                core_name = core_n
                return core_manifest, core_name, core_fullname

    raise SDKDirDoesNotExist('One of these packages is required: %s' % \
            ', '.join(ALLOWED_CORE_NAMES.keys()))


def get_or_create_core_author():
    " create or get Mozilla author "
    try:
        core_author = User.objects.get(username='mozilla')
    except:
        # create core user
        core_author = User.objects.create(
                            username='mozilla',
                            first_name='Mozilla')
        Profile.objects.create(user=core_author)
    return core_author


def _get_code(path):
    handle = open(path, 'r')
    code = handle.read()
    handle.close()
    return code


def add_core_modules(sdk_source, core_revision, core_author,
        core_name):
    " add all provided core modules to core_revision "

    def add_module_dir(core_lib_dir, subdirectory=''):
        core_modules = os.listdir(os.path.join(core_lib_dir, subdirectory))
        for module_file in core_modules:
            try:
                module_path = '%s/%s%s' % (core_lib_dir, subdirectory, module_file)
                module_name = "%s%s" % (subdirectory, os.path.splitext(module_file)[0])
                if os.path.isdir(module_path):
                    add_module_dir(core_lib_dir, "%s/" % module_name)
                else:
                    core_revision.module_create(
                        save=False,
                        filename=module_name,
                        code=_get_code(module_path),
                        author=core_author
                    )
                    #log.debug("module added %s" % module_name)
            except Exception, err:
                print ("Warning: There was a problem with importing module "
                       "from file %s/%s\n%s") % (core_lib_dir, module_file, err)

    add_module_dir('%s/packages/%s/lib' % (sdk_source, core_name))


def add_core_attachments(sdk_source, sdk_name, core_revision, core_author,
        core_name):
    " add attachements to the core_revision "

    def add_attachments_dir(core_data_dir, subdirectory=''):
        core_attachments = os.listdir(core_data_dir)
        # create upload directory
        if len(core_attachments) > 0:
            path_dir = os.path.join(sdk_name, core_name)
            upload_dir = os.path.join(settings.UPLOAD_DIR, path_dir, subdirectory)
            if not os.path.isdir(upload_dir):
                shutil.copytree(core_data_dir, upload_dir)
        for att_file in core_attachments:
            try:
                att_path = '%s/%s%s' % (core_data_dir, subdirectory, att_file)
                att_name, att_ext = os.path.splitext(att_file)
                att_name = '%s%s' % (subdirectory, att_name)
                att_ext = att_ext[1:]
                upload_path = '%s/%s.%s' % (path_dir, att_name, att_ext)

                core_revision.attachment_create(
                        filename=att_name,
                        ext=att_ext,
                        path=upload_path,
                        author=core_author)
            except Exception, err:
                print ("Warning: Importing module failed: %s\n%s" %
                        (att_path, str(err)))
    add_attachments_dir('%s/packages/%s/data' % (sdk_source, core_name))


def check_SDK_dir(sdk_dir_name):
    " check if SDK dir is valid "

    " check if the SDK was added already "
    try:
        SDK.objects.get(dir=sdk_dir_name)
        raise SDKDirNotUniqueException(
            "There might be only one SDK created from %s" % sdk_dir_name)
    except ObjectDoesNotExist:
        pass


def check_SDK_version(version):
    " check if SDK manifest is valid "
    try:
        SDK.objects.get(version=version)
        raise SDKVersionNotUniqueException(
            "There might be only one SDK versioned %s" % version)
    except ObjectDoesNotExist:
        pass


def _update_lib(package, author, manifest, version):
    check_SDK_version(version)
    contributors = [manifest['author']]
    contributors.extend(manifest['contributors'])

    package_revision = PackageRevision(
        package=package,
        author=author,
        contributors=', '.join(contributors),
        revision_number=package.latest.get_next_revision_number()
    )
    package_revision.save()
    package_revision.set_version(version)
    return package_revision


def _create_lib(author, manifest, full_name, name, id_number, version):
    check_SDK_version(version)

    # create Jetpack Core Library
    contributors = [manifest['author']]
    contributors.extend(manifest['contributors'])
    core = Package(
        author=author,
        full_name=full_name,
        name=name,
        type='l',
        public_permission=2,
        description=manifest['description'],
        id_number=id_number
    )
    core.save()
    revision = core.latest
    revision.set_version(manifest.get('version'), version)
    revision.contributors = ', '.join(contributors)
    super(PackageRevision, revision).save()
    return revision


def update_SDK(sdk_dir_name, options=None, version=None, should_import=False):
    " add new jetpack-core revision "

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name)

    core_author = get_or_create_core_author()

    # default values for SDK >= 1.12
    core_manifest = {}
    core_revision = None
    kit_manifest = None
    kit_revision = None

    # import code
    if should_import:
        core_manifest, core_name, core_fullname = get_core_manifest(sdk_source)

        core = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)
        core.name = core_name
        core.full_name = core_fullname
        core.save()

        if not version:
            version = core_manifest['version']

        core_revision = _update_lib(core, core_author, core_manifest, version)
        add_core_modules(sdk_source, core_revision, core_author, core_name)
        add_core_attachments(sdk_source, sdk_dir_name, core_revision, core_author,
                core_name)

        kit_name = 'addon-kit'
        kit_manifest = get_manifest(sdk_source, core_name=kit_name)
        if kit_manifest:
            try:
                kit = Package.objects.get(
                    id_number=settings.MINIMUM_PACKAGE_ID - 1)
                kit_revision = _update_lib(kit, core_author, kit_manifest, version)
            except Exception:  # TODO: be precise
                kit_revision = _create_lib(
                    core_author, kit_manifest, 'Addon Kit', kit_name,
                    settings.MINIMUM_PACKAGE_ID - 1, version)

            add_core_modules(sdk_source, kit_revision, core_author, kit_name)
            add_core_attachments(sdk_source, sdk_dir_name, kit_revision,
                    core_author, kit_name)

    # create SDK
    sdk = SDK.objects.create(
        version=core_manifest.get('version', version),
        core_lib=core_revision,
        kit_lib=kit_revision if kit_manifest else None,
        dir=sdk_dir_name,
        options=options
    )


def create_SDK(sdk_dir_name, options=None, version=None, should_import=None):
    " create first jetpack-core revision "
    print "creating core"

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name)
    core_author = get_or_create_core_author()

    # default values for SDK >= 1.12
    core_manifest = {}
    core_revision = None
    kit_manifest = None
    kit_revision = None

    if should_import:
        core_manifest, core_name, core_fullname = get_core_manifest(sdk_source)

        if not version:
            version = core_manifest['version']

        core_revision = _create_lib(
            core_author, core_manifest, core_fullname, core_name,
            settings.MINIMUM_PACKAGE_ID, version)
        add_core_modules(sdk_source, core_revision, core_author, core_name)
        add_core_attachments(sdk_source, sdk_dir_name, core_revision, core_author,
                core_name)

        kit_name = 'addon-kit'
        kit_manifest = get_manifest(sdk_source, core_name=kit_name)
        if kit_manifest:
            kit_revision = _create_lib(
                core_author, kit_manifest, 'Addon Kit', 'addon-kit',
                settings.MINIMUM_PACKAGE_ID - 1, version)
            add_core_modules(sdk_source, kit_revision, core_author, kit_name)
            add_core_attachments(sdk_source, sdk_dir_name, kit_revision,
                    core_author, kit_name)

    # create SDK
    sdk = SDK.objects.create(
        version=core_manifest.get('version', version),
        core_lib=core_revision,
        kit_lib=kit_revision if kit_manifest else None,
        dir=sdk_dir_name,
        options=options
    )
