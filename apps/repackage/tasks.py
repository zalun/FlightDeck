import commonware.log
import os.path
import urllib
import urllib2

from urlparse import urlparse

from celery.decorators import task
from django.conf import settings
from django.core.urlresolvers import reverse
from xpi.xpi_utils import info_write

from repackage.helpers import Repackage

log = commonware.log.getLogger('f.repackage.tasks')


@task(rate_limit='5/m')
def low_rebuild(*args, **kwargs):
    """A wrapper for :meth:`download_and_rebuild` needed to create
    different route in celery for low priority rebuilds
    https://bugzilla.mozilla.org/show_bug.cgi?id=656978
    """
    log.info("Starting low priority package rebuild...")
    return rebuild(*args, **kwargs)


@task(rate_limit='30/m')
def high_rebuild(*args, **kwargs):
    """A wrapper for :meth:`download_and_rebuild` needed to create
    different route in celery for high priority rebuilds
    https://bugzilla.mozilla.org/show_bug.cgi?id=656978
    """
    log.info("Starting high priority package rebuild...")
    return rebuild(*args, **kwargs)


def rebuild(location, upload, sdk_source_dir, hashtag,
        package_overrides={}, filename=None, pingback=None, post=None,
        **kwargs):
    """creates a Repackage instance, downloads xpi and rebuilds it

    :params:
        * location (String) location of the file to download rebuild ``XPI``
        * sdk_source_dir (String) absolute path of the SDK
        * hashtag (String) filename for the buid XPI
        * package_overrides (dict) override original ``package.json`` fields
        * filename (String) desired filename for the downloaded ``XPI``
        * pingback (String) URL to pass the result
        * post (String) urlified ``request.POST``
        * kwargs is just collecting the task decorator overhead

    :returns: (list) ``cfx xpi`` response where ``[0]`` is ``stdout`` and
              ``[1]`` ``stderr``
    """
    rep = Repackage()
    info_path = '%s.json' % os.path.join(settings.XPI_TARGETDIR, hashtag)
    if location:
        log.info("[%s] Starting package rebuild... (%s)" % (hashtag, location))
        try:
            rep.download(location)
        except Exception, err:
            info_write(info_path, 'error', str(err), hashtag)
            log.warning("%s: Error in downloading xpi (%s)\n%s" % (hashtag,
                location, str(err)))
            raise
        log.debug("[%s] XPI file downloaded (%s)" % (hashtag, location))
        if not filename:
            filename = '.'.join(
                os.path.basename(urlparse(location).path).split('.')[0:-1])

    elif upload:
        log.info("[%s] Starting package rebuild from upload" % hashtag)
        try:
            rep.retrieve(upload)
        except Exception, err:
            info_write(info_path, 'error', str(err), hashtag)
            log.warning("%s: Error in retrieving xpi (%s)\n%s" % (hashtag,
                upload, str(err)))
            raise
        log.debug("[%s] XPI file retrieved from upload" % hashtag)
        if not filename:
            filename = '.'.join(upload.name.split('.')[0:-1])

    else:
        log.error("[%s] No location or upload provided" % hashtag)
        raise ValueError("No location or upload provided")

    try:
        response = rep.rebuild(sdk_source_dir, hashtag, package_overrides)
    except Exception, err:
        info_write(info_path, 'error', str(err), hashtag)
        log.warning("%s: Error in rebuilding xpi (%s)" % (hashtag, str(err)))
        raise
    log.debug('[%s] Response from rebuild: %s' % (hashtag, str(response)))

    if pingback:
        data = {
            'id': rep.manifest['id'],
            'secret': settings.AMO_SECRET_KEY,
            'result': 'success' if not response[1] else 'failure',
            'msg': response[1] or response[0],
            'location': "%s%s" % (settings.SITE_URL,
                reverse('jp_download_xpi', args=[hashtag, filename]))}
        if post:
            data['request'] = post
        log.debug('[%s] Pingback: %s' % (hashtag, pingback))
        urllib2.urlopen(pingback, data=urllib.urlencode(data),
                timeout=settings.URLOPEN_TIMEOUT)
    log.info("[%s] Finished package rebuild." % hashtag)
    return response
