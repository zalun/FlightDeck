import os
import simplejson

import commonware.log
from django.conf import settings
from django.contrib.auth.decorators import user_passes_test
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template import RequestContext, loader
from django.views.debug import get_safe_settings

from jetpack.models import Package, SDK
import base.tasks
from base.models import CeleryResponse

log = commonware.log.getLogger('f.monitor')


@user_passes_test(lambda u: u.is_superuser)
def site_settings(request):
    safe = sorted(list(get_safe_settings().items()))
    return render_to_response(
        'settings.html',
        {'settings': safe},
        context_instance=RequestContext(request))


def monitor(request):
    status = True
    data = {}

    filepaths = [
         (settings.UPLOAD_DIR, os.R_OK | os.W_OK, 'We want read + write.'),
    ]

    if hasattr(settings, 'XPI_TARGETDIR'):
        filepaths.append((settings.XPI_TARGETDIR, os.R_OK | os.W_OK,
                          'We want read + write. Should be a shared directory '
                          'on multiserver installations'))

    for sdk in SDK.objects.all():
        filepaths.append((sdk.get_source_dir(), os.R_OK,
                          'We want read on %s' % sdk.version),)

    filepath_results = []
    filepath_status = True

    for path, perms, notes in filepaths:
        path_exists = os.path.isdir(path)
        path_perms = os.access(path, perms)
        filepath_status = filepath_status and path_exists and path_perms
        if not filepath_status and status:
            status = False
        filepath_results.append((path, path_exists, path_perms, notes))

    # free space on XPI_TARGETDIR disk
    x_path = '%s/' % settings.XPI_TARGETDIR
    s_path = '%s/' % settings.SDKDIR_PREFIX
    x = os.statvfs(x_path)
    s = os.statvfs(s_path)
    data['free'] = {
            'xpi_targetdir %s' % x_path: (x.f_bavail * x.f_frsize) / 1024,
            'sdkdir_prefix %s' % s_path: (s.f_bavail * s.f_frsize) / 1024
            }

    data['filepaths'] = filepath_results
    template = loader.get_template('monitor.html')
    data['celery_responses'] = CeleryResponse.objects.all()

    context = RequestContext(request, data)
    status = 200 if status else 500

    return HttpResponse(template.render(context), status=status)


def monitor_file_check(request):
    monitor_file = request.POST.get('monitor_file')
    file_existed = False
    if os.path.isfile(monitor_file):
        # delete file
        os.remove(monitor_file)
        # return JSON
        file_existed = True
    return HttpResponse(simplejson.dumps({"success": file_existed}))


def homepage(r):
    # one more for the main one
    addons_limit = settings.HOMEPAGE_PACKAGES_NUMBER

    libraries = Package.objects.libraries()[:settings.HOMEPAGE_PACKAGES_NUMBER]
    addons = Package.objects.addons()[:addons_limit]

    addons = list(addons)
    page = 'homepage'

    return render_to_response(
        'homepage.html',
        {'libraries': libraries,
         'addons': addons,
         'page': page
        },
        context_instance=RequestContext(r))


def robots(request):
    data = "User-agent: *\n"
    if not settings.ENGAGE_ROBOTS:
        data += "Disallow: /"
    else:
        data += "Allow: /\n"
        urls = ["/xpi/prepare_test/",
                "/xpi/prepare_download/",
                "/xpi/test/",
                "/xpi/download/",
                "/xpi/remove/"]
        for url in urls:
            data += "Disallow %s\n" % url
    return HttpResponse(data, content_type='text/plain')
