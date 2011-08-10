from django.contrib.syndication.views import Feed
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from base.helpers import urlparams
from search.forms import SearchForm
from search.helpers import package_search


_TYPES = {'a': 'addon', 'l': 'library'}

class PackageFeed(Feed):
    search_type = False
    search_query = False
    query = None

    def description(self):
        description = 'New '
        if (self.search_type):
            description += '%(type)s '
        description += 'packages in the Add-on Builder'
        if (self.search_query):
            description += ' matching search "%(query)s"'
        return _(description) % {'type': self.search_type,
                                 'query': self.search_query}

    def get_object(self, request):
        form = SearchForm(request.GET)
        form.is_valid()
        self.query = query = form.cleaned_data

        t = query.get('type')
        self.search_type = _TYPES.get(t)
        self.search_query = query.get('q', '')

        filters = {}
        if t:
            filters['type'] = t

        if query.get('author'):
            filters['author'] = query['author'].id

        if query.get('copies'):
            filters['copies_count'] = query['copies']

        return package_search(self.search_query, user=request.user,
                **filters).order_by('-created_at')[:20]

    def title(self):
        title = 'Add-on Builder: New '
        if self.search_type:
            title += '%(type)s '
        title += 'packages'
        if (self.search_query):
            title += ' matching search "%(query)s"'
        return _(title) % {'type': self.search_type,
                           'query': self.search_query}

    def link(self, obj):
        return urlparams(reverse('search'), **self.query)

    def feed_url(self):
        return urlparams(reverse('search.rss'), **self.query)

    def items(self, data):
        return data

    def item_title(self, item):
        return item.full_name

    def item_description(self, item):
        return item.description

    def item_link(self, item):
        return item.get_absolute_url()

    def item_author_name(self, item):
        return item.author.get_full_name()

    def item_author_link(self, item):
        return item.get_author_profile_url()

    def item_pubdate(self, item):
        return item.created_at
