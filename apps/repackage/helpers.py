"""
repackage.helpers
-----------------
"""

import rdflib

import commonware.log
from django.conf import settings

log = commonware.log.getLogger('f.repackage')


class Extractor(object):
    """Extracts manifest from ``install.rdf``
    modified ``Extractor`` class from ``zamboni/apps/versions/compare.py``
    """
    manifest = u'urn:mozilla:install-manifest'
    ADDON_EXTENSION = '2'

    def __init__(self, install_rdf):
        self.rdf = rdflib.Graph().parse(install_rdf)
        self.find_root()
        # TODO: check if it's a JetPack addon
        self.data = {}

    def read_manifest(self, package_overrides={}):
        """Extracts data from ``install.rdf``, assignes it to ``self.data``

        :param: target_version (String) forces the version
        :returns: dict
        """
        data = {
            # since SDK 1.0b5 id has no longer be synced with public key
            'id': self.find('id').split('@')[0],
            'type': self.find('type') or self.ADDON_EXTENSION,
            'fullName': self.find('name'),
            'version': self.find('version'),
            'url': self.find('homepageURL'),
            'description': self.find('description'),
            'author': self.find('creator'),
            'license': self.find('license'),
            'lib': self.find('lib') or settings.JETPACK_LIB_DIR,
            'data': self.find('data') or settings.JETPACK_DATA_DIR,
            'tests': self.find('tests') or 'tests',
            #'packages': self.find('packages') or 'packages',
            'main': self.find('main') or 'main',
            'no_restart': True,
        }
        for key, value in data.items():
            if value or package_overrides.get(key, None):
                self.data[key] = package_overrides.get(key, None) or value
        return self.data

    def uri(self, name):
        namespace = 'http://www.mozilla.org/2004/em-rdf'
        return rdflib.term.URIRef('%s#%s' % (namespace, name))

    def find_root(self):
        # If the install-manifest root is well-defined, it'll show up when we
        # search for triples with it. If not, we have to find the context that
        # defines the manifest and use that as our root.
        # http://www.w3.org/TR/rdf-concepts/#section-triples
        manifest = rdflib.term.URIRef(self.manifest)
        if list(self.rdf.triples((manifest, None, None))):
            self.root = manifest
        else:
            self.root = self.rdf.subjects(None, self.manifest).next()

    def find(self, name, ctx=None):
        """Like $() for install.rdf, where name is the selector."""
        if ctx is None:
            ctx = self.root
        # predicate it maps to <em:{name}>.
        match = list(self.rdf.objects(ctx, predicate=self.uri(name)))
        # These come back as rdflib.Literal, which subclasses unicode.
        if match:
            return unicode(match[0])
