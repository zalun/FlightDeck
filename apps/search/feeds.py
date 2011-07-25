from django.contrib.syndication.views import Feed
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from search.helpers import query


class PackageFeed(Feed):
    search_type = False
    search_query = False

    def description(self):
        description = 'New '
        if (self.search_type):
            description += '%(type)s '
        description += 'packages in the Add-on Builder'
        if (self.search_query):
            description += ' matching search "%(query)s"'
        return _(description) % {'type': self.search_type,
                                 'query': self.search_query}

    def get_object(self, request, type_):
        self.search_type = type_
        self.search_query = request.GET.get('q', '')
        if type_ == 'combined':
            self.search_type = None
        return query(self.search_query, self.search_type, user=request.user,
                     filter_by_user=False, page=1, limit=20,
                     score_on='created_at')

    def title(self):
        title = 'Add-on Builder: New '
        if self.search_type:
            title += '%(type)s '
        title += 'packages'
        if (self.search_query):
            title += ' matching search "%(query)s"'
        return _(title) % {'type': self.search_type,
                           'query': self.search_query}

    def link(self):
        if self.search_type in ['addon', 'library']:
            url = reverse('search_by_type', args=[self.search_type])
        else:
            url = reverse('search.combined')
        if self.search_query:
            url += '?q=%s' % self.search_query
        return url

    def items(self, data):
        return data['pager'].object_list

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
