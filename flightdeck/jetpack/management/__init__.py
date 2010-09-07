import os
import simplejson

from django.db.models import signals
from django.contrib.auth.models import User

from django.db.utils import IntegrityError
from django.core.exceptions import ObjectDoesNotExist

from jetpack import models as jetpack_models
from jetpack.models import Package, Module, PackageRevision, SDK
from jetpack import settings
from person.models import Profile


class BaseException(Exception):
	def __init__(self, value):
	   self.parameter = value
	def __str__(self):
	   return repr(self.parameter)


class SDKVersionNotUniqueException(BaseException):
	pass

class SDKDirNotUniqueException(BaseException):
	pass

class SDKDirDoesNotExist(BaseException):
    pass



def create_or_update_jetpack_core(sdk_dir_name):
	try:
		x = SDK.objects.all()[0]
		return update_jetpack_core(sdk_dir_name)
	except Exception, e:
		return create_jetpack_core(sdk_dir_name)
	

def get_jetpack_core_manifest(sdk_source):
	if not os.path.isdir(sdk_source):
		raise SDKDirDoesNotExist("Jetpack SDK dir does not exist \"%s\"" % sdk_source)

	handle = open('%s/packages/jetpack-core/package.json' % sdk_source)
	manifest = simplejson.loads(handle.read())
	handle.close()
	return manifest


def get_or_create_core_author():
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
		except Exception, (e):
			print "Warning: There was a problem with importing module from file %s" % module_file


def check_SDK_dir(sdk_dir_name):
	" check if SDK dir is valid "

	" check if the SDK was added already "
	try:
		SDK.objects.get(dir=sdk_dir_name)
		raise SDKDirNotUniqueException("There might be only one SDK created from %s" % sdk_dir_name)
	except ObjectDoesNotExist:
		pass

def check_SDK_manifest(manifest):
	" check if SDK manifest is valid "
	try:
		SDK.objects.get(version=manifest['version'])
		raise SDKVersionNotUniqueException("There might be only one SDK versioned %s" % manifest['version'])
	except ObjectDoesNotExist:
		pass


def update_jetpack_core(sdk_dir_name):
	" add new jetpack-core revision "

	check_SDK_dir(sdk_dir_name)

	sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name) 

	core_author = get_or_create_core_author()
	core_manifest = get_jetpack_core_manifest(sdk_source)

	check_SDK_manifest(core_manifest)
	
	core_contributors = [core_manifest['author']]
	core_contributors.extend(core_manifest['contributors'])

	core = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)
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
	sdk = SDK.objects.create(
		version=core_manifest['version'],
		core_lib=core_revision,
		dir=sdk_dir_name
	)



def create_jetpack_core(sdk_dir_name='jetpack-sdk'):
	" create first jetpack-core revision "

	check_SDK_dir(sdk_dir_name)

	sdk_source = os.path.join(settings.SDK_SOURCE_DIR, sdk_dir_name) 
	core_author = get_or_create_core_author()
	core_manifest = get_jetpack_core_manifest(sdk_source)

	check_SDK_manifest(core_manifest)
	
	# create Jetpack Core Library
	core_contributors = [core_manifest['author']]
	core_contributors.extend(core_manifest['contributors'])
	core = Package(
		author=core_author, # sorry Atul
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
	sdk = SDK.objects.create(
		version=core_manifest['version'],
		core_lib=core_revision,
		dir=sdk_dir_name
	)



def install_jetpack_core(sender, created_models, **kwargs):
	# check if that's the syncdb to create jetpack models
	if not (jetpack_models.Package in created_models and \
			jetpack_models.PackageRevision in created_models):
		return
	
	create_jetpack_core()
	print "Jetpack Core Library created successfully"

signals.post_syncdb.connect(install_jetpack_core, sender=jetpack_models)

