from django.template import RequestContext
from django.shortcuts import render_to_response

from jetpack.models import Package
from jetpack import conf

def homepage(r):
    # one more for the main one
    addons_limit = conf.HOMEPAGE_PACKAGES_NUMBER

    libraries = Package.objects.libraries()[:conf.HOMEPAGE_PACKAGES_NUMBER]
    addons = Package.objects.addons()[:addons_limit]

    addons = list(addons)
    page = 'homepage'

    return render_to_response(
        'homepage.html',
        locals(),
        context_instance=RequestContext(r))
