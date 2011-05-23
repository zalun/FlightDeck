import commonware.log
import os.path
import simplejson
import urllib

from urlparse import urlparse

from celery.decorators import task
from django.conf import settings
from django.core.urlresolvers import reverse

from xpi import xpi_utils

from repackage.models import Repackage

log = commonware.log.getLogger('f.repackage.tasks')


@task(rate_limit='30/m')
def download_and_rebuild(location, sdk_source_dir, hashtag,
        package_overrides={}, filename=None, pingback=None, post=None):
    """creates a Repackage instance, downloads xpi and rebuilds it

    :params:
        * location (String) location of the file to download rebuild ``XPI``
        * sdk_source_dir (String) absolute path of the SDK
        * hashtag (String) filename for the buid XPI
        * package_overrides (dict) override original ``package.json`` fields
        * filename (String) desired filename for the downloaded ``XPI``
        * pingback (String) URL to pass the result
        * post (String) urlified ``request.POST``

    :returns: (list) ``cfx xpi`` response where ``[0]`` is ``stdout`` and
              ``[1]`` ``stderr``
    """
    rep = Repackage()
    rep.download(location)
    response = rep.rebuild(sdk_source_dir, hashtag, package_overrides)
    if not filename:
        filename = '.'.join(
            os.path.basename(urlparse(location).path).split('.')[0:-1])

    data = {
        'id': rep.manifest['id'],
        'secret': settings.BUILDER_SECRET_KEY,
        'result': 'success' if not response[1] else 'failure',
        'msg': response[1] if response[1] else response[0],
        'location': reverse('jp_download_xpi', args=[hashtag, filename])}
    if post:
        data['request'] = post

    if pingback:
        urllib.urlopen(pingback, data=urllib.urlencode(data))
    return response
