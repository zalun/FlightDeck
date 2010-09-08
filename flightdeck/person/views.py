from django.shortcuts import render_to_response, get_object_or_404
from django.http import Http404, HttpResponseRedirect, HttpResponse, HttpResponseRedirect
from django.template import RequestContext#,Template
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse
from django.core.paginator import Paginator, InvalidPage, EmptyPage

from person import settings
from person.models import Profile

def public_profile(r, username, force=None):
	"""
	Public profile
	"""
	page = "profile"
	person = get_object_or_404(User, username=username)
	profile = person.get_profile()
	addons = person.packages_originated.addons()
	libraries = person.packages_originated.libraries()
	# if owner of the profile and not specially wanted to see it - redirect to dashboard
	return render_to_response("profile.html", locals(),
				context_instance=RequestContext(r))

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
	addons, libraries, disabled_addons, disabled_libraries = get_packages(person)
	return render_to_response("user_dashboard.html", locals(),
				context_instance=RequestContext(r))


@login_required
def dashboard_browser(r, page_number=1, type=None, disabled=False):
	"""
	Display a list of addons or libraries with pages
	Filter based on the request (type, username).
	"""

	author = r.user
	packages = author.packages_originated.disabled() if disabled else author.packages_originated.active()

	if type: 
		other_type = 'l' if type == 'a' else 'a'
		other_packages_number = len(packages.filter(type=other_type))
		packages = packages.filter(type=type)
		template_suffix = settings.PACKAGE_PLURAL_NAMES[type]

	limit = r.GET.get('limit', settings.PACKAGES_PER_PAGE)

	pager = Paginator(
		packages,
		per_page = limit,
		orphans = 1
	).page(page_number)
	
	addons, libraries, disabled_addons, disabled_libraries = get_packages(author)

	return render_to_response(
		'user_%s.html' % template_suffix, locals(),
		context_instance=RequestContext(r))

