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

    :returns: (JSON) contains status and errors, actual xpi URLs are given in
              pingback response
    """
    # log whole request without SECRET
    log.debug(("Rebuild request (rebuild_addons):\n - addons: %s\n - sdk_version: %s\n"
        " - options: %s\n - pingback: %s\n - priority: %s") % (
            request.POST.get('addons'), request.POST.get('sdk_version'),
            request.POST.get('options', 'None'),
            request.POST.get('pingback', 'None'),
            request.POST.get('priority', 'None')))
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

def send_rebuild_task(package_key, location, upload, hashtag, rebuild_task,
        sdk_source_dir, package_overrides, filename, pingback, post, options,
        sdk_version):
    if package_key:
        # rebuild one addon from the pk
        log.debug('[%s] Rebuild started for location (%s)' %
                (hashtag, location))
        rebuild_task.delay(
                package_key, hashtag, sdk_version,
                package_overrides=package_overrides,
                pingback=pingback, filename=filename,
                post=post, options=options,
                callback=tasks.rebuild_addon)


    if location:
        # rebuild one add-on's XPI downloaded from location
        log.debug('[%s] Rebuild started for location (%s)' %
                (hashtag, location))
        rebuild_task.delay(
                location, sdk_source_dir, hashtag,
                package_overrides=package_overrides,
                filename=filename, pingback=pingback,
                post=post, options=options,
                callback=tasks.rebuild_from_location)

    if upload:
        # rebuild one add-on's from upload
        log.debug('[%s] Rebuild started from upload' % hashtag)
        rebuild_task.delay(
                upload, sdk_source_dir, hashtag,
                package_overrides=package_overrides,
                filename=filename, pingback=pingback,
                post=post, options=options,
                callback=tasks.rebuild_from_upload)

@csrf_exempt
@require_POST
def rebuild(request):
    """Rebuild ``XPI`` file. It can be provided as POST['location']

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :meth:`xpi.views.check_download` and
              :meth:`xpi.views.get_download`
    """
    # log whole request without SECRET
    keys = ('package_key', 'location', 'addons', 'upload', 'priority',
            'options')
    log.debug(("Rebuild request (rebuild):\n - "
        "%s\n") % "\n - ".join(["%s: %s" % (key, request.POST.get(key, 'None'))
            for key in keys]))
    # validate entries
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        log.error("Rebuild requested with an invalid key.  Rejecting.")
        return HttpResponseForbidden('Access denied')

    options = request.POST.get('options', None)

    package_key = request.POST.get('package_key', None)
    location = request.POST.get('location', None)
    addons = request.POST.get('addons', None)
    upload = request.FILES.get('upload', None)

    # validate entry
    if not package_key and not location and not upload and not addons:
        log.error("Rebuild requested but files weren't specified.  Rejecting.")
        return HttpResponseBadRequest('Please provide Add-ons to rebuild')
    if location and upload:
        log.error("Rebuild requested but location and upload provided."
                "Rejecting")
        return HttpResponseBadRequest('location and upload are mutually '
                                      'exclusive')
    if location and package_key:
        log.error("Rebuild requested but location and package_key provided."
                "Rejecting")
        return HttpResponseBadRequest('location and package_key are mutually'
                                      'exclusive')
    if upload and package_key:
        log.error("Rebuild requested but upload and package_key provided."
                "Rejecting")
        return HttpResponseBadRequest('upload and package_key are mutually'
                                      'exclusive')

    # prepare repackage common variables
    # locate SDK source directory
    sdk_version, sdk_source_dir = _get_sdk_source_dir(
            request.POST.get('sdk_version', None))
    pingback = request.POST.get('pingback', None)
    priority = request.POST.get('priority', None)
    if priority and priority == 'high':
        rebuild_task = tasks.high_rebuild
    else:
        rebuild_task = tasks.low_rebuild
    post = request.POST.urlencode()
    response = {'status': 'success'}
    hashtag = get_random_string(10)
    filename = request.POST.get('filename', None)
    errors = []
    counter = 0

    try:
        package_overrides = _get_package_overrides(request.POST,
                                                   sdk_version)
    except BadManifestFieldException, err:
        msg = '[%s] %s' % (hashtag, str(err))
        errors.append(msg)
        log.debug(msg)

    if package_key:
        try:
            package_key = int(package_key)
        except ValueError:
            msg = '[%s] package_key (%s) is not integer' % (hashtag,
                    package_key)
            errors.append(msg)
            log.debug(msg)

    if not errors:
        send_rebuild_task(package_key, location, upload, hashtag, rebuild_task,
                sdk_source_dir, package_overrides, filename, pingback, post,
                options, sdk_version)
        counter = counter + 1

    if addons:
        # loop over addons and rebuild the one by one
        try:
            addons = simplejson.loads(addons)
        except simplejson.decoder.JSONDecodeError, err:
            errors.append(str(err))
        else:
            for addon in addons:
                error = False
                filename = addon.get('filename', None)
                hashtag = get_random_string(10)
                options = addon.get('options', None)
                package_key = addon.get('package_key', None)
                location = addon.get('location', None)
                upload_name = addon.get('upload', None)
                upload = None
                if upload_name:
                    upload = request.FILES.get(upload_name, None)
                if not (package_key or location or upload):
                    errors.append("XPI for the addon not specified.")
                    error = True
                else:
                    if location and upload:
                        msg = ('location (%s) and upload are mutually'
                               ' exclusive') % location
                        errors.append(msg)
                        log.error(msg)
                        error = True
                    if location and package_key:
                        msg = ('location (%s) and package_key (%s) '
                               'are mutually exclusive') % (location, package_key)
                        errors.append(msg)
                        log.error(msg)
                        error = True
                    if upload and package_key:
                        msg = ('upload  and package_key (%s) '
                               'are mutually exclusive') % package_key
                        errors.append(msg)
                        log.error(msg)
                        error = True

                # have something valuable in the logs
                identifier = package_key or location or filename

                if not error:
                    try:
                        package_overrides = _get_package_overrides(addon,
                                sdk_version)
                    except Exception, err:
                        errors.append('[%s] %s' % (identifier, str(err)))
                        error = True

                if not error:
                    send_rebuild_task(package_key, location, upload, hashtag,
                            rebuild_task, sdk_source_dir, package_overrides,
                            filename, pingback, post, options, sdk_version)
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
