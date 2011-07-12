import os
import commonware.log
import codecs
import simplejson
import time
from statsd import statsd

from django.core.cache import cache
from django.views.static import serve
from django.http import HttpResponse, HttpResponseForbidden, HttpResponseServerError, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST
from django.conf import settings

from base.shortcuts import get_object_with_related_or_404
from jetpack.models import PackageRevision, SDK
from utils import validator
from utils.helpers import get_random_string
from xpi import xpi_utils
from xpi import tasks


log = commonware.log.getLogger('f.xpi')

@csrf_exempt
@require_POST
def prepare_test(r, id_number, revision_number=None):
    """
    Test XPI from data saved in the database
    """
    revision = get_object_with_related_or_404(PackageRevision,
                        package__id_number=id_number, package__type='a',
                        revision_number=revision_number)
    hashtag = r.POST.get('hashtag')
    if not hashtag:
        log.warning('[security] No hashtag provided')
        return HttpResponseForbidden('{"error": "No hashtag"}')
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    # prepare codes to be sent to the task
    mod_codes = {}
    att_codes = {}
    if r.POST.get('live_data_testing', False):
        for mod in revision.modules.all():
            if r.POST.get(mod.filename, False):
                code = r.POST.get(mod.filename, '')
                if mod.code != code:
                    mod_codes[str(mod.pk)] = code
        for att in revision.attachments.all():
            if r.POST.get(str(att.pk), False):
                code = r.POST.get(str(att.pk))
                att_codes[str(att.pk)] = code
    if mod_codes or att_codes or not os.path.exists('%s.xpi' %
            os.path.join(settings.XPI_TARGETDIR, hashtag)):
        log.info('[xpi:%s] Addon added to queue' % hashtag)
        tqueued = time.time()
        tkey = xpi_utils.get_queued_cache_key(hashtag, r)
        cache.set(tkey, tqueued, 120)
        tasks.xpi_build_from_model.delay(revision.pk,
                mod_codes=mod_codes, att_codes=att_codes,
                hashtag=hashtag, tqueued=tqueued)
    return HttpResponse('{"delayed": true}')

@never_cache
def get_test(r, hashtag):
    """
    return XPI file for testing
    """
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    base = os.path.join(settings.XPI_TARGETDIR, hashtag)
    mimetype = 'text/plain; charset=x-user-defined'
    tfile = time.time()
    try:
        xpi = codecs.open('%s.xpi' % base, mode='rb').read()
    except Exception, err:
        if os.path.exists('%s.json' % base):
            with open('%s.json' % base) as error_file:
                error_json = simplejson.loads(error_file.read())
            os.remove('%s.json' % base)
            if error_json['status'] == 'error':
                log.warning('Error creating xpi (%s)'
                        % error_json['message'] )
                return HttpResponseNotFound(error_json['message'])

        log.debug('[xpi:%s] Add-on not yet created: %s' % (hashtag, str(err)))
        return HttpResponse('')

    tend = time.time()
    tread = (tend - tfile) * 1000
    log.info('[xpi:%s] Add-on file found and read (%dms)' % (hashtag, tread))
    statsd.timing('xpi.build.fileread', tread)

    # Clean up
    if os.path.exists('%s.json' % base):
        os.remove('%s.json' % base)

    tkey = xpi_utils.get_queued_cache_key(hashtag, r)
    tqueued = cache.get(tkey)
    if tqueued:
        ttotal = (tend - tqueued) * 1000
        statsd.timing('xpi.build.total', ttotal)
        total = '%dms' % ttotal
    else:
        total = 'n/a'

    log.info('[xpi:%s] Downloading Add-on (%s)' % (hashtag, total))
    return HttpResponse(xpi, mimetype=mimetype)

@csrf_exempt
@require_POST
def prepare_download(r, id_number, revision_number=None):
    """
    Prepare download XPI.  This package is built asynchronously and we assume
    it works. It will be downloaded in ``get_download``
    """
    revision = get_object_with_related_or_404(PackageRevision,
                        package__id_number=id_number, package__type='a',
                        revision_number=revision_number)
    hashtag = r.POST.get('hashtag')
    if not hashtag:
        return HttpResponseForbidden('Add-on Builder has been updated!'
                'We have updated this part of the application. Please '
                'empty your cache and reload to get changes.')
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    log.info('[xpi:%s] Addon added to queue' % hashtag)
    tqueued = time.time()
    tkey = xpi_utils.get_queued_cache_key(hashtag, r)
    cache.set(tkey, tqueued, 120)
    tasks.xpi_build_from_model.delay(revision.pk, hashtag=hashtag,
            tqueued=tqueued)
    return HttpResponse('{"delayed": true}')


@never_cache
def check_download(r, hashtag):
    """Check if XPI file is prepared."""
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    # Check file if it exists
    if os.path.isfile(path):
        return HttpResponse('{"ready": true}')
    return HttpResponse('{"ready": false}')


@never_cache
def get_download(r, hashtag, filename):
    """
    Download XPI (it has to be ready)
    """
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    log.info('[xpi:%s] Downloading Addon from %s' % (filename, path))

    tend = time.time()
    tkey = xpi_utils.get_queued_cache_key(hashtag, r)
    tqueued = cache.get(tkey)
    if tqueued:
        ttotal = (tend - tqueued) * 1000
        statsd.timing('xpi.build.total', ttotal)
        total = '%dms' % ttotal
    else:
        total = 'n/a'

    log.info('[xpi:%s] Downloading Add-on (%s)' % (hashtag, total))

    response = serve(r, path, '/', show_indexes=False)
    response['Content-Disposition'] = ('attachment; '
            'filename="%s.xpi"' % filename)
    return response


@never_cache
def clean(r, path):
    " remove whole temporary SDK on request "
    # Validate sdk_name
    if not validator.is_valid('alphanum', path):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    xpi_utils.remove(os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % path))
    return HttpResponse('{"success": true}', mimetype='application/json')



@never_cache
def repackage(r, amo_id, amo_file, target_version=None, sdk_dir=None):
    """Pull amo_id/amo_file.xpi, schedule xpi creation, return hashtag
    """
    # validate entries
    # prepare data
    hashtag = get_random_string(10)
    sdk = SDK.objects.all()[0]
    # if (when?) choosing sdk_dir will be possible
    # sdk = SDK.objects.get(dir=sdk_dir) if sdk_dir else SDK.objects.all()[0]
    sdk_source_dir = sdk.get_source_dir()
    # extract packages
    tasks.repackage.delay(
            amo_id, amo_file, sdk_source_dir, hashtag, target_version)
    # call build xpi task
    # respond with a hashtag which will identify downloadable xpi
    # URL to check if XPI is ready:
    # /xpi/check_download/{hashtag}/
    # URL to download:
    # /xpi/download/{hashtag}/{desired_filename}/
    return HttpResponse('{"hashtag": "%s"}' % hashtag,
            mimetype='application/json')
