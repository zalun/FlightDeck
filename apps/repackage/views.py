"""
repackage.views
---------------
"""
import commonware
import simplejson

from django.conf import settings
from django.http import (HttpResponse, HttpResponseBadRequest,
        HttpResponseNotAllowed, HttpResponseForbidden)
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from jetpack.models import SDK
from utils.helpers import get_random_string
from utils import validator, exceptions

from repackage import tasks

log = commonware.log.getLogger('f.test')

class BadManifestFieldException(exceptions.SimpleException):
    """Wrong value in one of the Manifest fields
    """

def _get_package_overrides(container):
    package_overrides = {
        'version': container.get('version', None),
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
    if package_overrides.get('version', None) and not validator.is_valid(
            'alphanum_plus', package_overrides.get('version')):
        raise BadManifestFieldException("Wrong version format")
    return package_overrides


@csrf_exempt
@require_POST
def bulk_rebuild(request):
    """Launches a number of tasks to rebuild ``XPI`` files.
    https://bugzilla.mozilla.org/show_bug.cgi?id=656978
    `API discussion <https://bugzilla.mozilla.org/show_bug.cgi?id=656993>`_

    :returns: (JSON) Confirmation that all tasks has been launched
    """
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        return HttpResponseForbidden('Access denied')

    addons = request.POST.get('addons', None)
    if not addons:
        return HttpResponseBadRequest('No addons to rebuild')
    try:
        addons = simplejson.loads(addons)
    except Exception, err:
        log.critical(str(err))
        raise err

    # get latest SDK
    sdk = SDK.objects.all()[0]
    # if (when?) choosing POST['sdk_dir'] will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    sdk_source_dir = sdk.get_source_dir()

    pingback = request.POST.get('pingback', None)
    post = request.POST.urlencode()
    errors = []

    priority = request.POST.get('priority', None)
    if priotity and priority == 'high':
        rebuild = tasks.download_and_rebuild
    else:
        rebuild = tasks.bulk_download_and_rebuild

    for addon in addons:
        filename = addon.get('filename', None)
        hashtag = get_random_string(10)
        try:
            location = addon['location']
            package_overrides = _get_package_overrides(addon)
        except Exception, err:
            errors.append(err)
        else:
            rebuild.delay(
                location, sdk_source_dir, hashtag,
                package_overrides=package_overrides,
                filename=filename, pingback=pingback,
                post=post)

    response = {}
    if errors:
        response['status'] = 'some failures'
        response['errors'] = '\n'.join([str(e) for e in errors])
    else:
        response['status'] = 'success'

    return HttpResponse(simplejson.dumps(response),
            mimetype='application/json')


@csrf_exempt
@require_POST
def rebuild(request):
    """Rebuild ``XPI`` file. It can be pr")ided as POST['location']

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :method:`xpi.views.check_download` and
              :method:`xpi.views.get_download`
    """
    # validate entries
    secret = request.POST.get('secret', None)
    if not secret or secret != settings.AMO_SECRET_KEY:
        return HttpResponseForbidden('Access denied')

    location = request.POST.get('location', None)
    if not location:
        return HttpResponseBadRequest('Please provide URL of the XPI file')

    hashtag = get_random_string(10)
    # get latest SDK
    sdk = SDK.objects.all()[0]
    # if (when?) choosing POST['sdk_dir'] will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    sdk_source_dir = sdk.get_source_dir()

    # recognize entry values
    filename = request.POST.get('filename', None)
    pingback = request.POST.get('pingback', None)

    try:
        package_overrides = _get_package_overrides(request.POST)
    except BadManifestFieldException, err:
        return HttpResponseBadRequest(str(err))

    if priotity and priority == 'low':
        rebuild = tasks.bulk_download_and_rebuild
    else:
        rebuild = tasks.download_and_rebuild

    # call download and build xpi task
    tasks.download_and_rebuild.delay(
            location, sdk_source_dir, hashtag,
            package_overrides=package_overrides,
            filename=filename, pingback=pingback,
            post=request.POST.urlencode())

    return HttpResponse('{"hashtag": "%s"}' % hashtag,
            mimetype='application/json')
