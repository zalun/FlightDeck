import os
import commonware.log

from django.views.static import serve
from django.http import HttpResponse, HttpResponseForbidden
from django.conf import settings

from base.shortcuts import get_object_with_related_or_404
from utils import validator
from xpi import xpi_utils

from jetpack.models import PackageRevision


log = commonware.log.getLogger('f.xpi')


def prepare_test(r, id_number, revision_number=None):
    """
    Test XPI from data saved in the database
    """
    revision = get_object_with_related_or_404(PackageRevision,
                        package__id_number=id_number, package__type='a',
                        revision_number=revision_number)
    hashtag = r.POST.get('hashtag')
    if not hashtag:
        return HttpResponseForbidden('{"error": "No hashtag"}')
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
        response, rm_xpi_url = revision.build_xpi(modules, attachments,
                hashtag=hashtag)
    else:
        response, rm_xpi_url = revision.build_xpi(hashtag=hashtag)
    return HttpResponse('{"delayed": true, "rm_xpi_url": "%s"}' % rm_xpi_url)


def get_test(r, hashtag):
    """
    return XPI file for testing
    """
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    mimetype = 'text/plain; charset=x-user-defined'
    try:
        xpi = open(path, 'rb').read()
    except Exception, err:
        log.debug('Add-on not yet created: %s' % str(err))
        return HttpResponse('')
    log.info('Downloading Add-on: %s' % hashtag)
    return HttpResponse(xpi, mimetype=mimetype)


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
        return HttpResponseForbidden('Error: Try reload the page')
    revision.build_xpi(hashtag=hashtag)
    return HttpResponse('{"delayed": true}')


def check_download(r, hashtag):
    """Check if XPI file is prepared."""
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    # Check file if it exists
    if os.path.isfile(path):
        return HttpResponse('{"ready": true}')
    return HttpResponse('{"ready": false}')


def get_download(r, hashtag, filename):
    """
    Download XPI (it has to be ready)
    """
    path = os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % hashtag)
    log.info('Downloading %s.xpi from %s' % (filename, path))
    response = serve(r, path, '/', show_indexes=False)
    response['Content-Disposition'] = ('attachment; '
            'filename="%s.xpi"' % filename)
    return response


def clean(r, path):
    " remove whole temporary SDK on request "
    # Validate sdk_name
    if not validator.is_valid('alphanum_plus', path):
        return HttpResponseForbidden("{'error': 'Wrong name'}")
    xpi_utils.remove(os.path.join(settings.XPI_TARGETDIR, '%s.xpi' % path))
    return HttpResponse('{"success": true}', mimetype='application/json')
