import os
import commonware.log

from django.core.urlresolvers import reverse
from django.views.static import serve
from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponse, \
                        HttpResponseForbidden, HttpResponseServerError, \
                        Http404
from django.template import RequestContext
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

    # support temporary data
    if r.POST.get('live_data_testing', False):
        modules = []
        for mod in revision.modules.all():
            if r.POST.get(mod.filename, False):
                code = r.POST.get(mod.filename, '')
                if mod.code != code:
                    mod.code = code
                    modules.append(mod)
        (xpi_path, stdout, stderr) = revision.build_xpi_test(modules)

    else:
        # XXX: added test as build_xpi doesn't return
        (xpi_path, stdout, stderr) = revision.build_xpi_test()

    if stderr and not settings.DEBUG:
        # XXX: this should also log the error in file
        xpi_utils.remove(revision.get_sdk_dir())

    # return XPI url and cfx command stdout and stderr
    return render_to_response('json/test_xpi_created.json', {
        'stdout': stdout,
        'stderr': stderr,
        'test_xpi_url': reverse('jp_test_xpi', args=[
            xpi_path
        ]),
        'download_xpi_url': reverse('jp_download_xpi', args=[
            xpi_path,
            revision.package.name
        ]),
        'rm_xpi_url': reverse('jp_rm_xpi', args=[xpi_path]),
        'addon_name': '"%s (%s)"' % (
            revision.package.full_name, revision.get_version_name())
    }, context_instance=RequestContext(r))
    #    mimetype='application/json')


def prepare_download(r, id_number, revision_number=None, xpi_path=''):
    """
    Download XPI.  This package is built asynchronously and we assume it works.
    and let ``download_xpi`` handle the case where the file is not ready.
    """
    revision = get_object_with_related_or_404(PackageRevision,
                        package__id_number=id_number, package__type='a',
                        revision_number=revision_number)

    # If this is a retry, we won't rebuild... we'll just wait.
    # XXX: that would need to get xpi_path somehow
    retry = r.GET.get('retry')
    retry_url = reverse('jp_addon_revision_xpi',
                        args=[id_number, revision_number]) + '?retry=1'

    if not retry:
        (xpi_path, stdout, stderr) = revision.build_xpi_test()

    return get_download(r,
                        xpi_path,
                        revision.package.name,
                        retry=retry,
                        retry_url=retry_url,
                       )


def get_test(r, path):
    """
    return XPI file for testing
    """
    path = os.path.join(settings.XPI_TARGETDIR, path)
    mimetype = 'text/plain; charset=x-user-defined'

    try:
        xpi = open(path, 'rb').read()
    except Exception, err:
        log.critical('Error creating Add-on: %s' % str(err))
        return HttpResponseServerError

    return HttpResponse(xpi, mimetype=mimetype)


def get_download(r, path, filename, retry=False, retry_url=None):
    """Return XPI file for testing."""
    path = os.path.join(settings.XPI_TARGETDIR, path)
    f = '%s.xpi' % filename
    # Return file if it exists
    if os.path.isfile(path):
        r = serve(r, path, '/', show_indexes=False)
        r['Content-Type'] = 'application/octet-stream'
        r['Content-Disposition'] = 'attachment; filename="%s.xpi"' % filename
    elif retry:
        r = render_to_response('retry_download.html', dict(url=retry_url),
                               RequestContext(r))
    else:
        r = HttpResponseRedirect(retry_url)

    return r


def clean(r, path):
    " remove whole temporary SDK on request "
    # Validate sdk_name
    if not validator.is_valid('alphanum_plus', path):
        return HttpResponseForbidden("{'error': 'Wrong name'}")
    xpi_utils.remove(os.path.join(settings.XPI_TARGETDIR, path))
    return HttpResponse('{}', mimetype='application/json')
