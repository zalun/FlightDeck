import commonware

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm \
        as ContribAuthenticationForm
from django.utils.translation import ugettext_lazy as _

log = commonware.log.getLogger('f.authentication')


class AuthenticationForm(ContribAuthenticationForm):
    username = forms.CharField(label=_("Email address"), max_length=255)

    def clean(self):
        username = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if username and password:
            try:
                self.user_cache = authenticate(username=username,
                                               password=password)
            except Exception as err:
                log.critical("Authentication database connection failure: %s"
                            % str(err))
                raise forms.ValidationError(_(
                   "Sorry. Authentication process is broken"))

            if self.user_cache is None:
                raise forms.ValidationError(_(
                    """Your email and addons.mozilla.org password didn't match.
Please try again.
Note that both fields are case-sensitive."""))

            elif not self.user_cache.is_active:
                raise forms.ValidationError(_("This account is inactive."))

        # TODO: determine whether this should move to its own method.
        if self.request:
            if not self.request.session.test_cookie_worked():
                raise forms.ValidationError(_(
                    ("Your Web browser doesn't appear to have cookies enabled."
                     " Cookies are required for logging in.")))

        return self.cleaned_data
