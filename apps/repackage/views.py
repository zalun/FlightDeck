"""
repackage.views
---------------
"""
from django.http import HttpResponse
from django.views.decorators.cache import never_cache

from jetpack.models import SDK
from utils.helpers import get_random_string

from repackage import tasks


@never_cache
def download_and_rebuild(r, amo_id, amo_file, target_version=None, sdk_dir=None):
    """Pull amo_id/amo_file.xpi, schedule xpi creation, return hashtag

    :param: amo_id (Integer) id of the package in AMO (translates to direcory
            in ``ftp://ftp.mozilla.org/pub/mozilla.org/addons/``)
    :param: amo_file (String) filename of the XPI to download
    :param: target_version (String)

    :returns: (JSON) contains one field - hashtag it is later used to download
              the xpi using :method:`xpi.views.check_download` and
              :method:`xpi.views.get_download`
    """
    # validate entries
    # prepare data
    hashtag = get_random_string(10)
    sdk = SDK.objects.all()[0]
    # if (when?) choosing sdk_dir will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    sdk_source_dir = sdk.get_source_dir()
    # call build xpi task
    tasks.download_and_rebuild.delay(
            amo_id, amo_file, sdk_source_dir, hashtag, target_version)
    # respond with a hashtag which will identify downloadable xpi
    # URL to check if XPI is ready:
    # /xpi/check_download/{hashtag}/
    # URL to download:
    # /xpi/download/{hashtag}/{desired_filename}/
    return HttpResponse('{"hashtag": "%s"}' % hashtag,
            mimetype='application/json')

