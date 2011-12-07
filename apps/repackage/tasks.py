import commonware.log
import os.path
import urllib
import urllib2

from urlparse import urlparse
from celery.decorators import task

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import reverse

from repackage.helpers import Repackage, increment_version
from jetpack.models import PackageRevision, SDK
from xpi.xpi_utils import info_write

log = commonware.log.getLogger('f.repackage.tasks')

def rebuild_from_location(location, sdk_source_dir, hashtag,
        package_overrides=None, filename=None, pingback=None, post=None,
        options=None, **kwargs):
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
    if not package_overrides:
        package_overrides = {}
    rep = Repackage()
    info_path = '%s.json' % os.path.join(settings.XPI_TARGETDIR, hashtag)
    data = {
        'secret': settings.AMO_SECRET_KEY,
        'result': 'failure'}
    log.info("[%s] Starting package rebuild... (%s)" % (hashtag, location))
    try:
        rep.download(location)
    except Exception, err:
        log.debug("[%s] Saving error info to %s" % (hashtag, info_path))
        info_write(info_path, 'error', str(err), hashtag)
        log.warning("[%s] Error in downloading xpi (%s)\n%s" % (hashtag,
            location, str(err)))
        if pingback:
            data['msg'] = str(err)
            urllib2.urlopen(pingback, data=urllib.urlencode(data),
                    timeout=settings.URLOPEN_TIMEOUT)
        raise
    log.debug("[%s] XPI file downloaded (%s)" % (hashtag, location))
    if not filename:
        filename = '.'.join(
            os.path.basename(urlparse(location).path).split('.')[0:-1])

    try:
        response = rep.rebuild(sdk_source_dir, hashtag, package_overrides,
                               options=options)
    except Exception, err:
        info_write(info_path, 'error', str(err), hashtag)
        log.warning("%s: Error in rebuilding xpi (%s)" % (hashtag, str(err)))
        if pingback:
            data['msg'] = str(err)
            urllib2.urlopen(pingback, data=urllib.urlencode(data),
                    timeout=settings.URLOPEN_TIMEOUT)
        raise

    # successful rebuild
    log.debug('[%s] Response from rebuild: %s' % (hashtag, str(response)))

    if pingback:
        data.update({
            'id': rep.manifest['id'],
            'result': 'success' if not response[1] else 'failure',
            'msg': response[1] or response[0],
            'location': "%s%s" % (settings.SITE_URL,
                reverse('jp_download_xpi', args=[hashtag, filename]))})
        if post:
            data['request'] = post
        urllib2.urlopen(pingback, data=urllib.urlencode(data),
                timeout=settings.URLOPEN_TIMEOUT)
        log.debug('[%s] Pingback: %s' % (hashtag, pingback))
    log.info("[%s] Finished package rebuild." % hashtag)
    return response


def rebuild_from_upload(upload, sdk_source_dir, hashtag,
        package_overrides=None, filename=None, pingback=None, post=None,
        options=None, **kwargs):
    """creates a Repackage instance, downloads xpi and rebuilds it

    :params:
        * upload - uploaded XPI file
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
    if not package_overrides:
        package_overrides = {}
    rep = Repackage()
    info_path = '%s.json' % os.path.join(settings.XPI_TARGETDIR, hashtag)
    data = {
        'secret': settings.AMO_SECRET_KEY,
        'result': 'failure'}

    log.info("[%s] Starting package rebuild from upload" % hashtag)
    try:
        rep.retrieve(upload)
    except Exception, err:
        info_write(info_path, 'error', str(err), hashtag)
        log.warning("[%s] Error in retrieving xpi (%s)\n%s" % (hashtag,
            upload, str(err)))
        if pingback:
            data['msg'] = str(err)
            urllib2.urlopen(pingback, data=urllib.urlencode(data),
                    timeout=settings.URLOPEN_TIMEOUT)
        raise
    log.debug("[%s] XPI file retrieved from upload" % hashtag)
    if not filename:
        filename = '.'.join(upload.name.split('.')[0:-1])

    try:
        response = rep.rebuild(sdk_source_dir, hashtag, package_overrides,
                               options=options)
    except Exception, err:
        info_write(info_path, 'error', str(err), hashtag)
        log.warning("%s: Error in rebuilding xpi (%s)" % (hashtag, str(err)))
        if pingback:
            data['msg'] = str(err)
            urllib2.urlopen(pingback, data=urllib.urlencode(data),
                    timeout=settings.URLOPEN_TIMEOUT)
        raise
    log.debug('[%s] Response from rebuild: %s' % (hashtag, str(response)))

    if pingback:
        data.update({
            'id': rep.manifest['id'],
            'result': 'success' if not response[1] else 'failure',
            'msg': response[1] or response[0],
            'location': "%s%s" % (settings.SITE_URL,
                reverse('jp_download_xpi', args=[hashtag, filename]))})
        if post:
            data['request'] = post
        urllib2.urlopen(pingback, data=urllib.urlencode(data),
                timeout=settings.URLOPEN_TIMEOUT)
        log.debug('[%s] Pingback: %s' % (hashtag, pingback))
    log.info("[%s] Finished package rebuild." % hashtag)
    return response


def rebuild_addon(revision_pk, hashtag, sdk_version,
        package_overrides=None, pingback=None, filename=None, post=None,
        options=None, **kwargs):
    """
    Rebuild a revision defined by revision_pk

    :attr: hashtag (String) filename for the build XPI
    :attr: revision_pk (int) primary key of a
           :class``jetpack.models.PackageRevision` to rebuild

    Optional:
       :attr: sdk_version (string) unique for the SDK *ie. '1.2.1'*. If not
              given the latest available SDK will be used.
       :attr: package_overrides (dict) override original ``package.json``
              fields
       :attr: pingback (String) URL to pass the result
       :attr: filename (String) desired filename for the downloaded ``XPI``
       :attr: post (String) urlified ``request.POST``
       :attr: kwargs is just collecting the task decorator overhead
    """
    if not package_overrides:
        package_overrides = {}

    error = False

    # the json file with error message is written by build_xpi itself
    #info_path = '%s.json' % os.path.join(settings.XPI_TARGETDIR, hashtag)
    data = {
        'secret': settings.AMO_SECRET_KEY,
        'result': 'failure'}

    try:
        revision = PackageRevision.objects.get(pk=revision_pk)
    except ObjectDoesNotExist, err:
        response = ['', str(err)]
        error = True

    if not error:
        try:
            sdk = SDK.objects.get(version=sdk_version)
        except ObjectDoesNotExist, err:
            response = ['', str(err)]
            error = True

    if not error:
        if 'version' not in package_overrides:
            package_overrides['version'] = increment_version(
                    revision.get_version_name_only())
        if not filename:
            filename = '%s-%s' % (revision.package.name,
                                  package_overrides['version'])
        response = revision.build_xpi(hashtag=hashtag, sdk=sdk,
                package_overrides=package_overrides)
        if not response[1]:
            location = reverse('jp_download_xpi', args=[hashtag, filename])
            data.update({
                'id': revision.package.jid,
                'location': "%s%s" % (settings.SITE_URL, location)})

    if pingback:
        data.update({
            'result': 'success' if not response[1] else 'failure',
            'msg': response[1] or response[0]})
        if post:
            data['request'] = post
        urllib2.urlopen(pingback, data=urllib.urlencode(data),
                timeout=settings.URLOPEN_TIMEOUT)
        log.debug('[%s] Pingback: %s' % (hashtag, pingback))
    log.info("[%s] Finished package rebuild." % hashtag)
    return response


@task(rate_limit='5/m')
def low_rebuild(callback=None, *args, **kwargs):
    """A wrapper for :meth:`download_and_rebuild` needed to create
    different route in celery for low priority rebuilds
    https://bugzilla.mozilla.org/show_bug.cgi?id=656978
    """
    log.info("Starting low priority package rebuild...")
    return callback(*args, **kwargs)


@task(rate_limit='30/m')
def high_rebuild(callback=None, *args, **kwargs):
    """A wrapper for :meth:`download_and_rebuild` needed to create
    different route in celery for high priority rebuilds
    https://bugzilla.mozilla.org/show_bug.cgi?id=656978
    """
    log.info("Starting high priority package rebuild...")
    return callback(*args, **kwargs)
