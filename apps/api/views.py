import os
import commonware.log
import simplejson

from cuddlefish import apiparser

from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.conf import settings
from django.http import Http404, HttpResponse
from django.core.urlresolvers import reverse

from jetpack.models import SDK
from api.models import DocPage

log = commonware.log.getLogger('f.api')

sdks = SDK.objects.all()
if sdks.count() == 0:
    raise Exception('No SDK imported')

MAIN_SDK = sdks[0]
SDKPACKAGESDIR = os.path.join(
        settings.SDK_SOURCE_DIR, MAIN_SDK.dir, 'packages')
SDKVERSION = MAIN_SDK.version
ADDON_KIT = MAIN_SDK.kit_lib
CORELIB_NAME = MAIN_SDK.core_lib.package.name
DEFAULTLIB_NAME = ADDON_KIT.package.name \
        if ADDON_KIT else MAIN_SDK.core_lib.package.name


def _get_module_filenames(package_name):
    files = os.listdir(os.path.join(SDKPACKAGESDIR, package_name, 'docs'))
    files.sort()
    return files


def _get_module_names(package_name):
    DOC_FILES = _get_module_filenames(package_name)
    return [{'name': os.path.splitext(d)[0]} for d in DOC_FILES]
    DOC_FILES.sort()
    return DOC_FILES


def _get_package_fullname(package_name):
    special = {
            'jetpack-core': 'Core Library (%s)' % SDKVERSION,
            'addon-kit': 'Addon Kit (%s)' % SDKVERSION
            }
    if package_name in special.keys():
        return special[package_name]
    return package_name


def homepage(r, package_name=None):
    if not package_name:
        package_name = DEFAULTLIB_NAME
    page = 'apibrowser'

    DOC_LIST = [{
            'filename': page.path,
            'get_url': reverse('api_page', args=[page.path])
        } for page in DocPage.objects.filter(sdk=MAIN_SDK)]

    sdk_version = SDKVERSION

    return render_to_response(
        'api_homepage.html',
        {'page': page,
         'sdk_version': sdk_version,
         'doc_list': simplejson.dumps(DOC_LIST)
        }, context_instance=RequestContext(r))


def _get_hunks(text):
    # changing the tuples to dictionaries
    try:
        hunks = list(apiparser.parse_hunks(text))
    except Exception, err:
        log.error(str(err))
        hunks = [[None, '<p>Sorry. Error in reading the doc. '
            'Please check <a href="https://jetpack.mozillalabs.com/'
            'sdk/1.0b1/docs/#package/addon-kit">official docs</a></p>']]
    return hunks


def package(r, package_name=None):
    """
    containing a listing of all modules docs
    """
    if not package_name:
        package_name = DEFAULTLIB_NAME
    page = 'apibrowser'

    sdk_version = SDKVERSION

    DOC_FILES = _get_module_filenames(package_name)

    package = {
            'name': _get_package_fullname(package_name),
            'modules': []}
    for d in DOC_FILES:
        path = os.path.join(SDKPACKAGESDIR, package_name, 'docs', d)
        if not os.path.isdir(path):
            text = open(
                os.path.join(SDKPACKAGESDIR, package_name, 'docs', d)).read()
            hunks = _get_hunks(text)
            (doc_name, extension) = os.path.splitext(d)
            data = {}
            for h in hunks:
                data[h[0]] = h[1]
            package['modules'].append({
                'name': doc_name,
                'info': hunks[0][1],
                'data': data,
                'hunks': hunks
            })

    return render_to_response(
        'package_doc.html',
        {'page': page,
         'sdk_version': sdk_version,
         'package': package,
         'package_name': package_name,
         'corelib': (package_name == CORELIB_NAME),
         'addon_kit': ADDON_KIT
        },
        context_instance=RequestContext(r))


def module(r, package_name, module_name):
    page = 'apibrowser'

    sdk_version = SDKVERSION
    doc_file = '.'.join((module_name, 'md'))
    doc_path = os.path.join(SDKPACKAGESDIR,
                     package_name, 'docs', doc_file)
    try:
        text = open(doc_path).read()
    except Exception, err:
        log.error(str(err))
        raise Http404

    hunks = _get_hunks(text)

    entities = []
    for h in hunks:
        # convert JSON to a nice list
        if h[0] == 'api-json':
            h[1]['json_type'] = "api"
        entities.append(h[1])

    module = {
        'name': module_name,
        'info': hunks[0][1],
        'entities': entities,
        'hunks': hunks
    }
    package = {'name': _get_package_fullname(package_name),
               'modules': _get_module_names(package_name)}

    return render_to_response(
        'module_doc.html',
        {'page': page,
         'sdk_version': sdk_version,
         'package': package,
         'package_name': package_name,
         'module': module,
         'corelib': (package_name == CORELIB_NAME),
         'addon_kit': ADDON_KIT
        },
        context_instance=RequestContext(r))


def show_page(request, path):
    doc_page = get_object_or_404(DocPage, sdk=MAIN_SDK, path=path)
    DOC_LIST = [{
            'filename': page.path,
            'selected': page.path == path,
            'get_url': reverse('api_page', args=[page.path])
        } for page in DocPage.objects.filter(sdk=MAIN_SDK)]
    return render_to_response('api_page.html', {
            'doc_page':doc_page,
            'path': path,
            'doc_list': simplejson.dumps(DOC_LIST)
        }, context_instance=RequestContext(request))
