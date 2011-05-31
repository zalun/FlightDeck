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

from jetpack.models import SDK
from utils.helpers import get_random_string
from utils import validator, exceptions

from repackage import tasks

log = commonware.log.getLogger('f.repackage')


class BadManifestFieldException(exceptions.SimpleException):
    """Wrong value in one of the Manifest fields
    """


def _get_package_overrides(container):
    version = container.get('version', None)
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
    sdk = SDK.objects.all()[0]
    # if (when?) choosing POST['sdk_dir'] will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    return sdk.get_source_dir()


@csrf_exempt
@require_POST
def rebuild(request):
    """Rebuild ``XPI`` file. It can be provided as POST['location']

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :method:`xpi.views.check_download` and
              :method:`xpi.views.get_download`
    """
    # validate entries
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        log.error("Rebuild requested with an invalid key.  Rejecting.")
        return HttpResponseForbidden('Access denied')

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

    sdk_source_dir = _get_latest_sdk_source_dir()
    pingback = request.POST.get('pingback', None)
    priority = request.POST.get('priority', None)
    post = request.POST.urlencode()
    if priority and priority == 'high':
        rebuild = tasks.high_rebuild
    else:
        rebuild = tasks.low_rebuild
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
            package_overrides = _get_package_overrides(request.POST)
        except BadManifestFieldException, err:
            errors.append(str(err))
        else:
            rebuild.delay(
                    location, upload, sdk_source_dir, hashtag,
                    package_overrides=package_overrides,
                    filename=filename, pingback=pingback,
                    post=post)
            counter = counter + 1

    if addons:
        try:
            addons = simplejson.loads(addons)
        except Exception, err:
            log.error(str(err))
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
                    errors.append("Files not specified.")
                    error = True
                if location and upload:
                    errors.append("Location and upload provided - rejecting")
                    error = True
                try:
                    package_overrides = _get_package_overrides(addon)
                except Exception, err:
                    errors.append(err)
                    error = True
                if not error:
                    rebuild.delay(
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

    log.info("%d addon(s) will be created, %d error(s), uuid: %s" %
            (counter, len(errors), uuid))

    return HttpResponse(simplejson.dumps(response),
            mimetype='application/json')
