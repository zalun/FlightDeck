from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import ObjectDoesNotExist
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext

from person.models import Profile

def public_profile(r, username):
    """
    Public profile
    """
    page = "profile"
    try:
        profile = Profile.objects.get_user_by_username_or_nick(username)
    except ObjectDoesNotExist:
        raise Http404
    person = profile.user
    addons = person.packages_originated.addons()
    libraries = person.packages_originated.libraries()
    # if owner of the profile and not specially wanted to see it - redirect
    # to dashboard
    return render_to_response("profile.html", {
        'page': page,
        'person': person,
        'profile': profile,
        'addons': addons,
        'libraries': libraries
    }, context_instance=RequestContext(r))


def get_packages(person):
    addons = person.packages_originated.addons()
    libraries = person.packages_originated.libraries()
    disabled_addons = person.packages_originated.disabled().filter(type='a')
    disabled_libraries = person.packages_originated.disabled().filter(type='l')
    return addons, libraries, disabled_addons, disabled_libraries


@login_required
def dashboard(r):
    """
    Dashboard of the user
    """
    page = "dashboard"
    person = r.user
    (addons, libraries,
     disabled_addons, disabled_libraries) = get_packages(person)
    return render_to_response("user_dashboard.html", {
        'page': page,
        'person': person,
        'addons': addons,
        'libraries': libraries,
        'disabled_addons': disabled_addons,
        'disabled_libraries': disabled_libraries
    }, context_instance=RequestContext(r))


@login_required
def dashboard_browser(r, page_number=1, type=None, disabled=False):
    """
    Display a list of addons or libraries with pages
    Filter based on the request (type, username).
    """

    author = r.user
    packages = author.packages_originated.disabled() \
            if disabled else author.packages_originated.active()

    if type:
        other_type = 'l' if type == 'a' else 'a'
        other_packages_number = len(packages.filter(type=other_type))
        packages = packages.filter(type=type)
        template_suffix = settings.PACKAGE_PLURAL_NAMES[type]

    limit = r.GET.get('limit', settings.PACKAGES_PER_PAGE)

    pager = Paginator(
        packages,
        per_page=limit,
        orphans=1
    ).page(page_number)

    (addons, libraries, disabled_addons,
     disabled_libraries) = get_packages(author)

    return render_to_response(
        'user_%s.html' % template_suffix, {
            'pager': pager,
            'author': author,
            'addons': addons,
            'libraries': libraries,
            'disabled_addons': disabled_addons,
            'disabled_libraries': disabled_libraries,
            'other_packages_number': other_packages_number,
            'other_type': other_type
        }, context_instance=RequestContext(r))
