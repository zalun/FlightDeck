from django.conf import settings

PACKAGES_PER_PAGE =  getattr(settings, 'PACKAGES_PER_PAGE', 10)
PACKAGE_PLURAL_NAMES = {
	'l': 'libraries',
	'a': 'addons'
}
PACKAGE_SINGULAR_NAMES = {
	'l': 'library',
	'a': 'addon'
}
# ------------------------------------------------------------------------

