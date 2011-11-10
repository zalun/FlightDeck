"""
repackage.views
---------------
"""
import commonware
import simplejson

from django.conf import settings
from django.http import (HttpResponse, HttpResponseBadRequest,
        HttpResponseForbidden)
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist  # , ValidationError

from jetpack.models import SDK, PackageRevision
from utils.helpers import get_random_string
from utils import validator, exceptions

from repackage import tasks

log = commonware.log.getLogger('f.repackage')


class BadManifestFieldException(exceptions.SimpleException):
    """Wrong value in one of the Manifest fields
    """


def _get_package_overrides(container, sdk_version=None):
    """
    Prepare package overrides (from POST)
    sdk_version is used to override the version if {sdk_version} provided in
    optional container['version']

    :attr: container (dict) list of overrides
    :attr: sdk_version (string)
    """
    version = container.get('version', None)
    if version and sdk_version:
        version = version.format(sdk_version=sdk_version)

    package_overrides = {
        'version': version,
        'type': container.get('type', None),
        'fullName': container.get('fullName', None),
        'url': container.get('url', None),
        'description': container.get('description', None),
        'author': container.get('author', None),
        'license': container.get('license', None),
        'lib': container.get('lib', None),
        'data': container.get('data', None),
        'tests': container.get('tests', None),
        'main': container.get('main', None)
    }
    if version and not validator.is_valid('alphanum_plus', version):
        log.error("Wrong version format provided (%s)" % version)
        raise BadManifestFieldException("Wrong version format")
    return package_overrides


def _get_latest_sdk_source_dir():
    # get latest SDK
    sdk = SDK.objects.latest('pk')
    # if (when?) choosing POST['sdk_dir'] will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    return sdk.get_source_dir()


def _get_sdk_source_dir(sdk_version):
    if sdk_version:
        sdk = get_object_or_404(SDK, version=sdk_version)
        sdk_source_dir = sdk.get_source_dir()
    else:
        sdk_source_dir = (settings.REPACKAGE_SDK_SOURCE
            or _get_latest_sdk_source_dir())

        sdk_manifest = '%s/packages/%s/package.json' % (sdk_source_dir, 'addon-kit')
        try:
            handle = open(sdk_manifest)
        except Exception, err:
            log.critical("Problems loading SDK manifest\n%s" % str(err))
            raise
        else:
            sdk_version = simplejson.loads(handle.read())['version']
            handle.close()

    return sdk_version, sdk_source_dir


@csrf_exempt
@require_POST
def rebuild_addons(request):
    """Rebuild a :class:`~jetpack.models.PackageRevision` provided as a list
    of objects with given ``pk`` with a :class:`~jetpack.models.SDK`
    provided by it's version.

    It is required to provide following attributes via POST:
        :attr: secret (string) needs to be the same as
               ``settings.AMO_SECRET_KEY``
        :attr: addons (JSON list of objects)
        :attr: sdk_version (string) unique for the SDK *ie. '1.2.1'*

    Optional attributes:
        :attr: options (JSON object)
        :attr: pingback (string) url to respond with every build
        :attr: priority (string) if equals ``high``, the task will run at
               higher priority.

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :meth:`xpi.views.check_download` and
              :meth:`xpi.views.get_download`
    """
    # validate entries
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        log.error("Rebuild requested with an invalid secret key.  Rejecting.")
        return HttpResponseForbidden('Access denied')

    addons = request.POST.get('addons', None)
    if not addons:
        log.error("Add-ons rebuild called, but no add-ons where specified. "
                  "Rejecting.")
        return HttpResponseBadRequest('Please provide add-ons to rebuild')
    sdk_version = request.POST.get('sdk_version', None)
    if not sdk_version:
        log.error("SDK version not provided. Rejecting.")
        return HttpResponseBadRequest('Please provide SDK version')

    options = request.POST.get('options', None)
    pingback = request.POST.get('pingback', None)
    priority = request.POST.get('priority', None)
    post = request.POST.urlencode()

    if priority and priority == 'high':
        rebuild_task = tasks.high_rebuild
    else:
        rebuild_task = tasks.low_rebuild

    response = {'status': 'success'}
    errors = []
    counter = 0
    try:
        addons = simplejson.loads(addons)
    except Exception, err:
        errors.append('[%s] %s' % (hashtag, str(err)))
    else:
        for addon in addons:
            error = False
            hashtag = get_random_string(10)
            try:
                package_overrides = _get_package_overrides(addon, sdk_version)
            except Exception, err:
                errors.append('[%s] %s' % (hashtag, str(err)))
                error = True
            if not error:
                rebuild_task.delay(
                    addon['package_key'], hashtag, sdk_version,
                    callback=tasks.rebuild_addon,
                    package_overrides=package_overrides,
                    pingback=pingback,
                    post=post,
                    options=options)
            counter = counter + 1

    if errors:
        log.error("Errors reported when preparing for rebuild")
        response['status'] = 'some failures'
        response['errors'] = ''
        for e in errors:
            response['errors'] = "%s%s\n" % (response['errors'], e)
            log.error("    Error: %s" % e)

    response['addons'] = counter
    uuid = request.POST.get('uuid', 'no uuid')

    log.info("%d addon(s) will be created, %d syntax errors, uuid: %s" %
            (counter, len(errors), uuid))

    return HttpResponse(simplejson.dumps(response),
            mimetype='application/json')


@csrf_exempt
@require_POST
def rebuild(request):
    """Rebuild ``XPI`` file. It can be provided as POST['location']

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :meth:`xpi.views.check_download` and
              :meth:`xpi.views.get_download`
    """
    # validate entries
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        log.error("Rebuild requested with an invalid key.  Rejecting.")
        return HttpResponseForbidden('Access denied')

    options = request.POST.get('options', None)

    location = request.POST.get('location', None)
    addons = request.POST.get('addons', None)
    upload = request.FILES.get('upload', None)

    if not location and not upload and not addons:
        log.error("Rebuild requested but files weren't specified.  Rejecting.")
        return HttpResponseBadRequest('Please provide XPI files to rebuild')
    if location and upload:
        log.error("Rebuild requested but location and upload provided."
                "Rejecting")
        return HttpResponseBadRequest('Please provide XPI files to rebuild')

    # locate SDK source directory
    sdk_version, sdk_source_dir = _get_sdk_source_dir(
            request.POST.get('sdk_version', None))

    pingback = request.POST.get('pingback', None)
    priority = request.POST.get('priority', None)
    post = request.POST.urlencode()
    if priority and priority == 'high':
        rebuild_task = tasks.high_rebuild
    else:
        rebuild_task = tasks.low_rebuild
    response = {'status': 'success'}
    errors = []
    counter = 0

    if location or upload:
        hashtag = get_random_string(10)
        if location:
            log.debug('[%s] Single rebuild started for location (%s)' %
                    (hashtag, location))
        else:
            log.debug('[%s] Single rebuild started from upload' % hashtag)

        filename = request.POST.get('filename', None)

        try:
            package_overrides = _get_package_overrides(request.POST,
                                                       sdk_version)
        except BadManifestFieldException, err:
            errors.append('[%s] %s' % (hashtag, str(err)))
        else:
            rebuild_task.delay(
                    location, upload, sdk_source_dir, hashtag,
                    package_overrides=package_overrides,
                    filename=filename, pingback=pingback,
                    post=post, options=options)
            counter = counter + 1

    if addons:
        try:
            addons = simplejson.loads(addons)
        except Exception, err:
            errors.append(str(err))
        else:
            for addon in addons:
                error = False
                filename = addon.get('filename', None)
                hashtag = get_random_string(10)
                location = addon.get('location', None)
                upload_name = addon.get('upload', None)
                upload = None
                if upload_name:
                    upload = request.FILES.get(upload_name, None)
                if not (location or upload):
                    errors.append("[%s] Files not specified." % hashtag)
                    error = True
                if location and upload:
                    errors.append(("[%s] Location and upload provided. "
                        "Rejecting") % hashtag)
                    error = True
                try:
                    package_overrides = _get_package_overrides(addon,
                                                               sdk_version)
                except Exception, err:
                    errors.append('[%s] %s' % (hashtag, str(err)))
                    error = True
                if not error:
                    rebuild_task.delay(
                        location, upload, sdk_source_dir, hashtag,
                        package_overrides=package_overrides,
                        filename=filename, pingback=pingback,
                        post=post)
                    counter = counter + 1

    if errors:
        log.error("Errors reported when rebuilding")
        response['status'] = 'some failures'
        response['errors'] = ''
        for e in errors:
            response['errors'] = "%s%s\n" % (response['errors'], e)
            log.error("    Error: %s" % e)

    response['addons'] = counter
    uuid = request.POST.get('uuid', 'no uuid')

    log.info("%d addon(s) will be created, %d syntax errors, uuid: %s" %
            (counter, len(errors), uuid))

    return HttpResponse(simplejson.dumps(response),
            mimetype='application/json')


def sdk_versions(r):
    versions = SDK.objects.all().order_by('id')
    response = [sdk.version for sdk in versions]

    return HttpResponse(simplejson.dumps(response),
            mimetype='application/json')
