import os
import socket
import simplejson
import threading

import commonware.log
from django.conf import settings
from django.contrib.auth.decorators import user_passes_test
from django.http import HttpResponse
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext, loader
from django.views.debug import get_safe_settings
from django.template.loader import get_template

from elasticutils import get_es
import base.tasks
from search.cron import index_all, setup_mapping
from search.helpers import package_search
from jetpack.models import Package, SDK
from jetpack.cron import update_package_activity
from base.models import CeleryResponse

log = commonware.log.getLogger('f.monitor')


def app_manifest(request):
    # @TODO: Fill out more of this as we can (ie. widget, icons)
    data = {'version': settings.PROJECT_VERSION,
            'name': settings.SITE_TITLE,
            'description': ('Add-on Builder makes it easy to write, build and '
                            'test Firefox extensions using common web '
                            'technologies.'),
            #'icons': { },
            #'widget': { },
            'developer': {
                'name': 'Mozilla Flightdeck Team',
                'url': 'https://builder.addons.mozilla.org/',
            },
            'installs_allowed_from': [
                 'https://apps-preview-dev.allizom.org',
                 'https://apps-preview.allizom.org',
                 'https://apps-preview.mozilla.org',
                 'https://addons-dev.allizom.org',
                 'https://addons.allizom.org',
                 'https://addons.mozilla.org',
            ],
            'default_locale': 'en',
           }
    return HttpResponse(simplejson.dumps(data),
                        mimetype="application/x-web-app-manifest+json")


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


    return render_to_response('graphite.html', v,
                              context_instance=RequestContext(request))

@user_passes_test(lambda u: u.is_superuser)
def site_settings(request):
    safe = sorted(list(get_safe_settings().items()))
    return render_to_response(
        'settings.html',
        {'settings': safe},
        context_instance=RequestContext(request))

@user_passes_test(lambda u: u.is_superuser)
def admin(request):
    msg = ''
    if request.method == 'POST':
        action = request.POST.get('action')
        log_msg = '[admin] %s by %s (id: %d)'
        if action == 'setup_mapping':
            msg = 'setup_mapping triggered'
            log.info(log_msg % (msg, request.user, request.user.pk))
            threading.Thread(target=setup_mapping).start()            
        elif action == 'index_all':
            msg = 'index_all triggered'
            log.info(log_msg % (msg , request.user, request.user.pk))
            threading.Thread(target=index_all).start()            
        elif action == 'update_package_activity':
            msg = 'update_package_activity triggered'
            log.info(log_msg % (msg , request.user, request.user.pk))
            threading.Thread(target=update_package_activity).start()
        else:
            log.warning('[TAMPERING][admin] Action "%s" tried by %s (id: %s)'
                        % (action, request.user, request.user.pk))

    return render_to_response('admin.html', {
            'message': msg
        }, context_instance=RequestContext(request))


def monitor(request):
    status = True
    data = {}

    # Check Read/Write
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
    data['free'] = [
            ('xpi_targetdir %s' % x_path, x.f_bavail * x.f_frsize),
            ('sdkdir_prefix %s' % s_path, s.f_bavail * s.f_frsize)
            ]

    data['filepaths'] = filepath_results

    # Check celery
    try:
        data['celery_responses'] = CeleryResponse.objects.all()
    except:
        status = False

    # Check ElasticSearch
    try:
        es = get_es()
        data['es_health'] = es.cluster_health()
        data['es_health']['version'] = es.collect_info()['server']['version']['number']
        if data['es_health']['status'] =='red':
            status = False
            log.warning('ElasticSearch cluster health was red.')
    except Exception, e:
        status = False
        log.critical('Failed to connect to ElasticSearch: %s' % e)

    # Check memcached
    memcache = getattr(settings, 'CACHES', {}).get('default')
    memcache_results = []
    if memcache and 'memcached' in memcache['BACKEND']:
        hosts = memcache['LOCATION']
        if not isinstance(hosts, (tuple, list)):
            hosts = [hosts]
        for host in hosts:
            ip, port = host.split(':')
            try:
                s = socket.socket()
                s.connect((ip, int(port)))
            except Exception, e:
                status = False
                result = False
                log.critical('Failed to connect to memcached (%s): %s'
                             % (host, e))
            else:
                result = True
            finally:
                s.close()
            memcache_results.append((ip, port, result))
        if len(memcache_results) < 2:
            status = False
            log.warning('You should have 2+ memcache servers. '
                        'You have %d.' % len(memcache_results))

    if not memcache_results:
        status = False
        log.info('Memcached is not configured.')
    data['memcached'] = memcache_results

    # Check Redis
    # TODO: we don't currently use redis

    context = RequestContext(request, data)
    status = 200 if status else 500
    template = loader.get_template('monitor.html')
    return HttpResponse(template.render(context), status=status)


def get_package(request):    
    package = get_object_or_404(Package, id_number=request.GET['package_id'])    
    return render_to_response('admin/_package_result.html', {
            'package': package
        }, context_instance=RequestContext(request))

@user_passes_test(lambda u: u.is_superuser)
def update_package(request):
    package = get_object_or_404(Package, pk=request.POST['package_id'])  
    if 'featured' in request.POST:        
        package.featured = request.POST.get('featured') == 'true'
        
    if 'example' in request.POST:       
        package.example = request.POST.get('example') == 'true'
        
    package.save()    
    return HttpResponse({'status':'ok'}, content_type='text/javascript')
    
    
def homepage(r):
    # one more for the main one
    pkgs_limit = settings.HOMEPAGE_PACKAGES_NUMBER

    libraries = package_search(type='l').order_by('-activity')[:pkgs_limit]
    addons = package_search(type='a').order_by('-activity')[:pkgs_limit]

    #libraries = Package.objects.libraries().active().sort_recently_active()[:pkgs_limit]
    #addons = Package.objects.addons().active().sort_recently_active()[:pkgs_limit]

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
