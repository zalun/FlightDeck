from django import forms
from django.contrib.auth.models import User

class SearchForm(forms.Form):
    q = forms.CharField(required=False)
    page = forms.IntegerField(required=False, initial=1)
    type = forms.ChoiceField(required=False,
            choices=(('l', 'Libraries'),('a', 'Add-ons')))
    author = forms.ModelChoiceField(required=False, queryset=User.objects.all())
    copies = forms.IntegerField(required=False, initial=0)
