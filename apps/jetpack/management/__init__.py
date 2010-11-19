" Predefined for all Jetpack commands "
import os
import simplejson

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings

from jetpack.models import Package, Module, PackageRevision, SDK
from person.models import Profile


class SimpleException(Exception):
    " Exception to be inherited in more precised Exception "

    def __init__(self, value=None):
        self.parameter = value

    def __str__(self):
        return repr(self.parameter)


class SDKVersionNotUniqueException(SimpleException):
    " Not unique version of SDK "


class SDKDirNotUniqueException(SimpleException):
    " There is already a SDK build from that directory "


class SDKDirDoesNotExist(SimpleException):
    " No such dir "


def create_or_update_SDK(sdk_dir_name):
    " call create or update depending on the current staus "
    sdk_number = SDK.objects.count()
    if sdk_number > 0:
        return update_SDK(sdk_dir_name)
    return create_SDK(sdk_dir_name)


def get_manifest(sdk_source, core_name='jetpack-core'):
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


def add_core_modules(sdk_source, core_revision, core_author,
        core_name='jetpack-core'):
    " add all provided core modules to core_revision "

    def _get_code(path):
       handle = open(path, 'r')
       code = handle.read()
       handle.close()
       return code

    core_lib_dir = '%s/packages/%s/lib' % (sdk_source, core_name)
    core_modules = os.listdir(core_lib_dir)
    # @TODO: it should be recurrent
    for module_file in core_modules:
        try:
            module_path = '%s/%s' % (core_lib_dir, module_file)
            module_name = os.path.splitext(module_file)[0]
            if os.path.isdir(module_path):
                submodules = os.listdir(module_path)
                for submodule_file in submodules:
                    submodule_name = '%s/%s' % (module_name,
                            os.path.splitext(submodule_file)[0])
                    submodule_path = '%s/%s/%s' % (
                            core_lib_dir, module_name, submodule_file)
                    core_revision.module_create(
                            save=False,
                            filename=submodule_name,
                            code=_get_code(submodule_path),
                            author=core_author
                            )
            else:
                core_revision.module_create(
                    save=False,
                    filename=module_name,
                    code=_get_code(module_path),
                    author=core_author
                )
        except Exception, err:
            print ("Warning: There was a problem with importing module "
                   "from file %s/%s\n%s") % (core_lib_dir,module_file, err)


def check_SDK_dir(sdk_dir_name):
    " check if SDK dir is valid "

    " check if the SDK was added already "
    try:
        SDK.objects.get(dir=sdk_dir_name)
        raise SDKDirNotUniqueException(
            "There might be only one SDK created from %s" % sdk_dir_name)
    except ObjectDoesNotExist:
        pass


def check_SDK_manifest(manifest):
    " check if SDK manifest is valid "
    try:
        SDK.objects.get(version=manifest['version'])
        raise SDKVersionNotUniqueException(
            "There might be only one SDK versioned %s" % manifest['version'])
    except ObjectDoesNotExist:
        pass


def _update_lib(package, author, manifest):
    check_SDK_manifest(manifest)
    contributors = [manifest['author']]
    contributors.extend(manifest['contributors'])

    package_revision = PackageRevision(
        package=package,
        author=author,
        contributors=', '.join(contributors),
        revision_number=package.latest.get_next_revision_number()
    )
    package_revision.save()
    package_revision.set_version(manifest['version'])
    return package_revision

def _create_lib(author, manifest, full_name, name, id_number):
    check_SDK_manifest(manifest)

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
    revision.set_version(manifest['version'])
    revision.contributors = ', '.join(contributors)
    super(PackageRevision, revision).save()
    return revision

def update_SDK(sdk_dir_name):
    " add new jetpack-core revision "
    print "updating sdk"

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name)

    core_author = get_or_create_core_author()
    core_manifest = get_manifest(sdk_source)

    core = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)
    core_revision = _update_lib(core, core_author, core_manifest)
    add_core_modules(sdk_source, core_revision, core_author)

    kit_name = 'addon-kit'
    kit_manifest = get_manifest(sdk_source, core_name=kit_name)
    if kit_manifest:
        try:
            kit = Package.objects.get(
                id_number=settings.MINIMUM_PACKAGE_ID - 1)
            kit_revision = _update_lib(kit, core_author, kit_manifest)
        except Exception: # TODO: be precise
            kit_revision = _create_lib(
                core_author, kit_manifest, 'Addon Kit', kit_name,
                settings.MINIMUM_PACKAGE_ID-1)

        add_core_modules(sdk_source, kit_revision, core_author,
                core_name=kit_name)

    # create SDK
    SDK.objects.create(
        version=core_manifest['version'],
        core_lib=core_revision,
        kit_lib=kit_revision if kit_manifest else None,
        dir=sdk_dir_name
    )


def create_SDK(sdk_dir_name='jetpack-sdk'):
    " create first jetpack-core revision "
    print "creating core"

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name)
    core_author = get_or_create_core_author()
    core_manifest = get_manifest(sdk_source)

    core_revision = _create_lib(
        core_author, core_manifest, 'Jetpack Core', 'jetpack-core',
        settings.MINIMUM_PACKAGE_ID)
    add_core_modules(sdk_source, core_revision, core_author)

    kit_name = 'addon-kit'
    kit_manifest = get_manifest(sdk_source, core_name=kit_name)
    if kit_manifest:
        kit_revision = _create_lib(
            core_author, kit_manifest, 'Addon Kit', 'addon-kit',
            settings.MINIMUM_PACKAGE_ID-1)
        add_core_modules(sdk_source, kit_revision, core_author,
                core_name=kit_name)

    # create SDK
    SDK.objects.create(
        version=core_manifest['version'],
        core_lib=core_revision,
        kit_lib=kit_revision if kit_manifest else None,
        dir=sdk_dir_name
    )
