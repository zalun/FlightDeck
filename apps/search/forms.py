from django import forms
from django.forms.util import ErrorDict
from django.contrib.auth.models import User

from base.forms import CleanForm

TYPE_CHOICES = (
    ('l', 'Libraries'),
    ('a', 'Add-ons'),
)

SORT_CHOICES = (
    ('score','score'),
    ('activity','activity'),
    ('forked','forked'),
    ('used','used'),
    ('new','new'),
    ('size','size')
)

class SearchForm(CleanForm):
    q = forms.CharField(required=False)
    page = forms.IntegerField(required=False, initial=1)
    type = forms.ChoiceField(required=False, choices=TYPE_CHOICES)
    author = forms.ModelChoiceField(required=False, queryset=User.objects.all())
    copies = forms.IntegerField(required=False, initial=0)
    used = forms.IntegerField(required=False, initial=0)
    activity = forms.IntegerField(required=False, initial=0)
    sort = forms.ChoiceField(required=False, choices=SORT_CHOICES)
