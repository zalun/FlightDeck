import commonware

from django.conf import settings
from django.contrib.auth.models import User

from nose.tools import eq_
from pyes import StringQuery, FieldQuery, FieldParameter
from elasticutils import S
from elasticutils.tests import ESTestCase

from jetpack.models import Package
from search.helpers import query, aggregate

log = commonware.log.getLogger('f.test.search')


def create_addon(name):
    return create_package(name, type='a')


def create_library(name):
    return create_package(name, type='l')


def create_package(name, type, **kwargs):
    u = User.objects.get(username='john')
    return Package.objects.create(full_name=name, author=u, type=type, **kwargs)



class TestSearch(ESTestCase):
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


class QueryTest(ESTestCase):
    """
    search.helpers.query has some built in defaults and such, and is the only
    way that we actually query the index. Test that sucker.
    """

    fixtures = ('mozilla_user', 'users', 'core_sdk')


    def test_initial_packages_excluded(self):
        bar = create_addon('super bar')
        create_addon('super baz')

        self.es.refresh()

        data = query('super')
        eq_(0, data['total'])

        bar.latest.set_version('1.1')

        self.es.refresh()
        data2 = query('super')
        eq_(1, data2['total'])

    def test_copied_packages_excluded(self):
        foo = create_addon('foo tastic')
        foo.latest.set_version('1.0')

        fart = foo.copy(foo.author)
        foo.latest.save_new_revision(fart)

        self.es.refresh()
        data = query('foo')
        eq_(1, data['total'])


class AggregateQueryTest(ESTestCase):
    """
    search.helpers.aggregate is used to be able to show results from both
    addons and libraries on the same page.
    """

    fixtures = ('mozilla_user', 'users', 'core_sdk')

    def test_combined(self):
        noob = create_addon('noobs r us')
        noob.latest.set_version('1.noob')

        newb = create_library('noobs are the new newbs')
        newb.latest.set_version('QQ')

        self.es.refresh()
        data = aggregate('noobs')

        eq_('noobs', data['q'])
        self.assertTrue('addons' in data)
        self.assertTrue('libraries' in data)
        eq_(2, data['total'])
