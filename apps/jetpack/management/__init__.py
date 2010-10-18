" Predefined for all Jetpack commands "
import os
import simplejson

from django.contrib.auth.models import User

from django.core.exceptions import ObjectDoesNotExist

from jetpack.models import Package, Module, PackageRevision, SDK
from jetpack import conf
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


def create_or_update_jetpack_core(sdk_dir_name):
    " call create or update depending on the current staus "
    try:
        SDK.objects.all()[0]
        return update_jetpack_core(sdk_dir_name)
    except Exception:
        return create_jetpack_core(sdk_dir_name)


def get_jetpack_core_manifest(sdk_source):
    " parse the SDK's manifest "
    if not os.path.isdir(sdk_source):
        raise SDKDirDoesNotExist(
            "Jetpack SDK dir does not exist \"%s\"" % sdk_source)

    handle = open('%s/packages/jetpack-core/package.json' % sdk_source)
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


def add_core_modules(sdk_source, core_revision, core_author):
    " add all provided core modules to core_revision "
    core_lib_dir = '%s/packages/jetpack-core/lib' % sdk_source
    core_modules = os.listdir(core_lib_dir)
    for module_file in core_modules:
        try:
            module_path = '%s/%s' % (core_lib_dir, module_file)
            module_name = os.path.splitext(module_file)[0]
            handle = open(module_path, 'r')
            module_code = handle.read()
            handle.close()
            mod = Module.objects.create(
                filename=module_name,
                code=module_code,
                author=core_author
            )
            core_revision.modules.add(mod)
        except Exception, err:
            print ("Warning: There was a problem with importing module "
                   "from file %s/%s") % (core_lib_dir,module_file)


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


def update_jetpack_core(sdk_dir_name):
    " add new jetpack-core revision "

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(conf.SDK_SOURCE_DIR, sdk_dir_name)

    core_author = get_or_create_core_author()
    core_manifest = get_jetpack_core_manifest(sdk_source)

    check_SDK_manifest(core_manifest)

    core_contributors = [core_manifest['author']]
    core_contributors.extend(core_manifest['contributors'])

    core = Package.objects.get(id_number=conf.MINIMUM_PACKAGE_ID)
    # create new revision
    core_revision = PackageRevision(
        package=core,
        author=core_author,
        contributors=', '.join(core_contributors),
        revision_number=core.latest.get_next_revision_number()
    )
    core_revision.save()
    core_revision.set_version(core_manifest['version'])

    add_core_modules(sdk_source, core_revision, core_author)

    # create SDK
    SDK.objects.create(
        version=core_manifest['version'],
        core_lib=core_revision,
        dir=sdk_dir_name
    )


def create_jetpack_core(sdk_dir_name='jetpack-sdk'):
    " create first jetpack-core revision "

    check_SDK_dir(sdk_dir_name)

    sdk_source = os.path.join(conf.SDK_SOURCE_DIR, sdk_dir_name)
    core_author = get_or_create_core_author()
    core_manifest = get_jetpack_core_manifest(sdk_source)

    check_SDK_manifest(core_manifest)

    # create Jetpack Core Library
    core_contributors = [core_manifest['author']]
    core_contributors.extend(core_manifest['contributors'])
    core = Package(
        author=core_author,
        full_name='Jetpack Core',
        name='jetpack-core',
        type='l',
        public_permission=2,
        description=core_manifest['description']
    )
    core.save()
    core_revision = core.latest
    core_revision.set_version(core_manifest['version'])
    core_revision.contributors = ', '.join(core_contributors)
    super(PackageRevision, core_revision).save()
    add_core_modules(sdk_source, core_revision, core_author)

    # create SDK
    SDK.objects.create(
        version=core_manifest['version'],
        core_lib=core_revision,
        dir=sdk_dir_name
    )
