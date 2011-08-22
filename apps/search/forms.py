from django import forms
from django.forms.utils import ErrorDict
from django.contrib.auth.models import User

TYPE_CHOICES = (
    ('l', 'Libraries'),
    ('a', 'Add-ons'),
)

class SearchForm(forms.Form):
    q = forms.CharField(required=False)
    page = forms.IntegerField(required=False, initial=1)
    type = forms.ChoiceField(required=False, choices=TYPE_CHOICES)
    author = forms.ModelChoiceField(required=False, queryset=User.objects.all())
    copies = forms.IntegerField(required=False, initial=0)

    def full_clean(self):
        """
        Cleans self.data and populates self._errors and self.cleaned_data.

        Does not remove cleaned_data if there are errors.
        """
        self._errors = ErrorDict()
        if not self.is_bound: # Stop further processing.
            return

        self.cleaned_data = {}
        # If the form is permitted to be empty, and none of the form data
        # has changed from the initial data, short circuit any validation.
        if self.empty_permitted and not self.has_changed():
            return
        self._clean_fields()
        self._clean_form()
        self._post_clean()
