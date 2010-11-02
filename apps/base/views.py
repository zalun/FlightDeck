from django.template import RequestContext
from django.shortcuts import render_to_response
from django.conf import settings

from jetpack.models import Package


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
