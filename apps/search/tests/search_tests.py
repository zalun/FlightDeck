import commonware

from django.contrib.auth.models import User

from nose.tools import eq_
from nose import SkipTest
from pyes import StringQuery, FieldQuery, FieldParameter
from elasticutils.tests import ESTestCase
from elasticutils import F

from jetpack.models import Package
from search.helpers import package_search
from search.cron import setup_mapping

log = commonware.log.getLogger('f.test.search')


def create_addon(name):
    return create_package(name, type='a')


def create_library(name):
    return create_package(name, type='l')


def create_package(name, type, **kwargs):
    u = User.objects.get(username='john')
    return Package.objects.create(full_name=name, author=u, type=type,
                                  **kwargs)



class MappedESTestCase(ESTestCase):
    """
    FlightDeck has special mapping that needs to be put into the index for
    the tests to work, so put the mapping each time the index is re-created.
    """
    @classmethod
    def setup_class(cls):
        super(MappedESTestCase, cls).setup_class()
        setup_mapping()



class TestSearch(MappedESTestCase):
    fixtures = ('mozilla_user', 'users', 'core_sdk')

    def test_index(self, name='zool'):
        """Create an add-on and verify that we can find it in elasticsearch."""
        a = create_addon(name)
        es = self.es
        es.refresh()
        r = es.search(query=StringQuery(name))
        eq_(r['hits']['total'], 1)
        eq_(r['hits']['hits'][0]['_source']['name'], a.name)
        return a

    def test_index_delete(self):
        """Create an add-on then delete it, )erify it's not in the index."""
        a = self.test_index('fool')
        a.delete()
        es = self.es
        es.refresh()
        r = es.search(query=StringQuery('fool'))
        eq_(r['hits']['total'], 0, "We shouldn't get any hits.")

    def test_index_removed_private_addon(self):
        """
        When an addon is marked private, it should be removed from the index.
        """
        a = self.test_index('bink')
        a.disable()
        es = self.es
        es.refresh()
        r = es.search(query=StringQuery('bink'))
        eq_(r['hits']['total'], 0, "We shouldn't get any hits.")

    def test_index_removed_limbo_deleted_library(self):
        """
        If package in limbo deleted=True state, should not be in index.
        """
        a = self.test_index('glur')
        a.deleted = True
        a.save()
        es = self.es
        es.refresh()
        r = es.search(query=StringQuery('glur'))
        eq_(r['hits']['total'], 0, "We shouldn't get any hits.")

    def test_index_dependencies(self):
        """
        Test that we are indexing the dependent ids.

        In this example we'll make a libraries bar and barf.
        Which add-on foo is dependent on....

        WILL IT INDEX?

        """
        bar = create_library('bar')
        barf = create_library('barf')
        addon = create_addon('foo')
        addon.latest.dependency_add(bar.latest)
        addon.latest.dependency_add(barf.latest)
        es = self.es
        es.refresh()

        for lib in (bar, barf):
            r = es.search(query=FieldQuery(FieldParameter('dependencies',
                                                          lib.id)))
            eq_(r['hits']['total'], 1)
            eq_(r['hits']['hits'][0]['_source']['name'], addon.name)
        return (addon, bar, barf)

    def test_index_dependencies_remove(self):
        (addon, bar, barf) = self.test_index_dependencies()
        addon.latest.dependency_remove(bar.latest)
        addon.latest.dependency_remove(barf.latest)
        es = self.es
        es.refresh()

        for lib in (bar, barf):
            r = es.search(query=FieldQuery(FieldParameter('dependencies',
                                                          lib.id)))
            eq_(r['hits']['total'], 0)


class PackageSearchTest(MappedESTestCase):
    fixtures = ('mozilla_user', 'users', 'core_sdk',)

    def test_times_depended_on(self):
        foo = create_library('foooooo')
        bar = create_addon('barrrr')

        bar.latest.dependency_add(foo.latest)

        self.es.refresh()

        qs = Package.search().filter(times_depended__gte=1)

        eq_(len(qs), 1)
        eq_(qs[0], foo)

class PackageHelperSearchTest(MappedESTestCase):
    """
    search.helpers.package_search has some built-in sane defaults when
    searching for Packages.
    """

    fixtures = ('mozilla_user', 'users', 'core_sdk')

    def test_initial_packages_excluded(self):
        bar = create_addon('super bar')
        create_addon('super baz')

        self.es.refresh()

        data = package_search('super')
        eq_(0, len(data))

        bar.latest.set_version('1.1')

        self.es.refresh()
        data2 = package_search('super')
        eq_(1, len(data2))

    def test_copied_packages_excluded(self):
        foo = create_addon('foo tastic')
        foo.latest.set_version('1.0')

        fart = foo.copy(foo.author)
        foo.latest.save_new_revision(fart)

        self.es.refresh()
        data = package_search('foo')
        eq_(1, len(data))

    def test_type_facet_filter(self):
        """)
        Type facet should not have a type filter in it's facet_filter.
        """
        buzz = create_addon('buzz lightyear')
        buzz.latest.set_version('Infinity')

        toystory = create_library('the toy story')
        toystory.latest.set_version('1')

        self.es.refresh()
        data = package_search(type='a')

        eq_(1, len(data))

        types = dict((f['term'], f['count']) for f in data.facets['types'])
        eq_(1, types.get('a'))
        eq_(1, types.get('l'))


    def test_custom_scoring(self):
        raise SkipTest()
        baz = create_addon('score baz')
        baz.latest.set_version('1.0')

        quux = create_addon('score quux')
        quux.latest.set_version('1.0')
        quux.latest.set_version('1.1')

        self.es.refresh()

        data = query('score', score_on='version')
        """
        Since quux has more versions than baz, it will have a higher score
        and should be the first result.
        """
        eq_([p.name for p in data['pager'].object_list], [quux.name, baz.name])


