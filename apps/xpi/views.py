import os
import commonware.log
import codecs

from django.views.static import serve
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST
from django.conf import settings

from base.shortcuts import get_object_with_related_or_404
from utils import validator
from xpi import xpi_utils

from jetpack.models import PackageRevision


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
    if r.POST.get('live_data_testing', False):
        modules = []
        for mod in revision.modules.all():
            if r.POST.get(mod.filename, False):
                code = r.POST.get(mod.filename, '')
                if mod.code != code:
                    mod.code = code
                    modules.append(mod)
        attachments = []
        for att in revision.attachments.all():
            if r.POST.get(str(att.pk), False):
                code = r.POST.get(str(att.pk))
                att.code = code
                attachments.append(att)
        response = revision.build_xpi(modules, attachments,
                hashtag=hashtag)
    else:
        response = revision.build_xpi(hashtag=hashtag)
    return HttpResponse('{"delayed": true}')

@never_cache
def get_test(r, hashtag):
    """
    return XPI file for testing
    """
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    mimetype = 'text/plain; charset=x-user-defined'
    try:
        xpi = codecs.open(path, mode='rb').read()
    except Exception, err:
        log.debug('Add-on not yet created: %s' % str(err))
        return HttpResponse('')
    log.info('Downloading Add-on: %s' % hashtag)
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
                'We have updated this part of the pplication, please '
                'empty your cache and reload to get changes.')
    if not validator.is_valid('alphanum', hashtag):
        log.warning('[security] Wrong hashtag provided')
        return HttpResponseForbidden("{'error': 'Wrong hashtag'}")
    revision.build_xpi(hashtag=hashtag)
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
    log.info('Downloading %s.xpi from %s' % (filename, path))
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
