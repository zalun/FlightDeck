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
from elasticutils import get_es

log = commonware.log.getLogger('f.monitor')

def graphite(request, site):
    # This code (and the template) is ugly as hell.  Since we aren't on Jinja
    # yet we can't use the same views/templates as the other projects, so we
    # have to hack together our own.  This is temporary until we can replace it
    # with jinja code.

    v = {}
    v['ns'] = {"trunk": "builder.preview",
               "stage": "builder.next",
               "prod": "builder"}[site]  # Validated by url regex
    v['base'] = "https://graphite-sjc.mozilla.org/render/?width=586&height=308"
    v['spans'] = { "fifteen": "from=-15minutes&title=15 minutes",
                   "hour": "from=-1hours&title=1 hour",
                   "day": "from=-24hours&title=24 hours",
                   "week": "from=-7days&title=7 days", }


    return render_to_response('graphite.html', v)

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
    try:
        data['celery_responses'] = CeleryResponse.objects.all()
    except:
        status = False

    try:
        es = get_es()
        data['es_health'] = es.cluster_health()
        data['es_health']['version'] = es.collect_info()['server']['version']['number']
    except:
        status = False

    context = RequestContext(request, data)
    status = 200 if status else 500

    return HttpResponse(template.render(context), status=status)


def homepage(r):
    # one more for the main one
    addons_limit = settings.HOMEPAGE_PACKAGES_NUMBER

    libraries = Package.objects.libraries().active().sort_recently_active()[:settings.HOMEPAGE_PACKAGES_NUMBER]
    addons = Package.objects.addons().active().sort_recently_active()[:addons_limit]

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
