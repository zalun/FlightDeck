import os

from cuddlefish import apiparser

from django.shortcuts import render_to_response
from django.template import RequestContext

from api import conf


def _get_module_filenames(package_name):
    files = os.listdir(os.path.join(conf.SDKPACKAGESDIR, package_name, 'docs'))
    files.sort()
    return files


def _get_module_names(package_name):
    DOC_FILES = _get_module_filenames(package_name)
    return [{'name': os.path.splitext(d)[0]} for d in DOC_FILES]
    DOC_FILES.sort()
    return DOC_FILES


def homepage(r, package_name='jetpack-core'):
    page = 'apibrowser'

    sdk_version = conf.SDKVERSION
    package = {'name': package_name,
               'modules': _get_module_names(package_name)}

    return render_to_response(
        'api_homepage.html',
        {'page': page,
         'sdk_version': sdk_version,
         'package': package,
         'package_name': package_name
        }, context_instance=RequestContext(r))


def package(r, package_name='jetpack-core'):
    """
    containing a listing of all modules docs
    """
    page = 'apibrowser'

    sdk_version = conf.SDKVERSION

    DOC_FILES = _get_module_filenames(package_name)

    package = {'name': package_name, 'modules': []}
    for d in DOC_FILES:
        text = open(
            os.path.join(conf.SDKPACKAGESDIR, package_name, 'docs', d)).read()
        (doc_name, extension) = os.path.splitext(d)
        # changing the tuples to dictionaries
        hunks = list(apiparser.parse_hunks(text))
        data = {}
        for h in hunks:
            data[h[0]] = h[1]
        package['modules'].append({
            'name': doc_name,
            'info': hunks[0][1],
            'data': data,
            'hunks': hunks
        })

    print locals()
    return render_to_response(
        'package_doc.html',
        {'page': page,
         'sdk_version': sdk_version,
         'package': package,
         'package_name': package_name,
        },
        context_instance=RequestContext(r))


def module(r, package_name, module_name):
    page = 'apibrowser'

    sdk_version = conf.SDKVERSION
    doc_file = '.'.join((module_name, 'md'))
    text = open(
        os.path.join(conf.SDKPACKAGESDIR,
                     package_name, 'docs', doc_file)).read()
    # changing the tuples to dictionaries
    hunks = list(apiparser.parse_hunks(text))
    data = []
    for h in hunks:
        # convert JSON to a nice list
        if h[0] == 'api-json':
            entity = h[1]
            entity['template'] = '_entity_%s.html' % entity['type']
            data.append(entity)

    module = {
        'name': module_name,
        'info': hunks[0][1],
        'data': data,
        'hunks': hunks
    }
    package = {'name': package_name,
               'modules': _get_module_names(package_name)}

    return render_to_response(
        'module_doc.html',
        {'page': page,
         'sdk_version': sdk_version,
         'package': package,
         'package_name': package_name,
         'module': module
        },
        context_instance=RequestContext(r))
