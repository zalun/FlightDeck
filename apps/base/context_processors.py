from django.conf import settings as _settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.core.urlresolvers import reverse
from django.utils.http import urlquote


def settings(request):
    return {'settings': _settings}


def uri(request):
    login_url = _settings.LOGIN_URL
    path = request.get_full_path()
    if path.startswith('/addon') or path.startswith('/library'):
        login_with_return = '%s?%s=%s' % (
                login_url, urlquote(REDIRECT_FIELD_NAME), urlquote(path))
    else:
        login_with_return = login_url
    return {'login_url': login_with_return}
