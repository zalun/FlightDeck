"""
repackage.helpers
-----------------
"""
import os
import rdflib
import shutil
import simplejson
import tempfile
import urllib2
import zipfile

import commonware.log
from django.conf import settings
from django.http import Http404
from django.template.defaultfilters import slugify

from xpi import xpi_utils

log = commonware.log.getLogger('f.repackage')


class Extractor(object):
    """
    Extracts manifest from ``install.rdf``

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
        """
        Extracts data from ``install.rdf``, assignes it to ``self.data``

        :param: target_version (String) forces the version
        :returns: dict
        """
        data = {
            # since SDK 1.0b5 id has no longer be synced with public key
            'id': self.find('id'),
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


class Repackage(object):

    def download(self, location):
        """
        Downloads the XPI (from ``location``) and
        instantiates XPI in ``self.xpi_zip``

        This eventually will record statistics about build times

        :param: location (String) location of the file to download rebuild
                ``XPI``

        :returns: None
        """

        log.info("Downloading file to rebuild from (%s)" % location)
        try:
            xpi_remote_file = urllib2.urlopen(location,
                    timeout=settings.URLOPEN_TIMEOUT)
        except IOError, err:
            log.warning("Downloading XPI (%s) for rebuild failed\n(%s)" %
                    (location, str(err)))
            raise
        else:
            # this check is needed as urlopen behaves different for
            # URLs starting with file:// (we use it in tests)
            if (hasattr(xpi_remote_file, 'getcode')
                    and xpi_remote_file.getcode()):
                if xpi_remote_file.getcode() == 404:
                    log.warning("URL does not exist (%s)" % location)
                    raise Http404
                elif xpi_remote_file.getcode() != 200:
                    log.warning("URL (%s) could not be open (%s)" %
                            (location, xpi_remote_file.getcode()))
                    raise Http404

        # zipfile doesn't work on the urllib filelike entities
        self.xpi_temp = tempfile.TemporaryFile()
        self.xpi_temp.write(xpi_remote_file.read())
        self.xpi_zip = zipfile.ZipFile(self.xpi_temp)
        xpi_remote_file.close()

    def retrieve(self, xpi_from):
        """
        Handles upload

        :param: xpi_from (element of request.FILES)
        """
        self.xpi_temp = tempfile.TemporaryFile()
        for chunk in xpi_from.chunks():
            self.xpi_temp.write(chunk)
        self.xpi_zip = zipfile.ZipFile(self.xpi_temp)

    def rebuild(self, sdk_source_dir, hashtag, package_overrides={}):
        """
        Drive the rebuild process

        :param: sdk_source_dir (String) absolute path of the SDK
        :param: hashtag (String) filename for the buid XPI
        :param: target_version (String)
        """
        self.get_manifest(package_overrides=package_overrides)
        sdk_dir = self.extract_packages(sdk_source_dir)
        # build xpi
        log.debug("[%s] Rebuilding XPI" % hashtag)
        response = xpi_utils.build(sdk_dir,
                os.path.join(sdk_dir, 'packages', self.manifest['name']),
                self.manifest['name'], hashtag)
        log.debug("[%s] Done rebuilding XPI; cleaning up" % hashtag)
        # clean up (sdk_dir is already removed)
        self.cleanup()
        return response

    def get_manifest(self, package_overrides={}):
        """
        extracts manifest from ``install.rdf`` it does not contain all
        dependencies, these will be appended during copying package files

        Sets the ``self.manifest`` field
        """
        # extract data provided in install.rdf
        install_rdf = self.xpi_zip.open('install.rdf')
        extracted = Extractor(install_rdf)
        self.manifest = extracted.read_manifest(
                package_overrides=package_overrides)
        # get data provided by harness-options.json
        ho_json = self.xpi_zip.open('harness-options.json')
        self.harness_options = simplejson.loads(ho_json.read())
        ho_json.close()
        # ``name`` is provided since SDK 1.0b2, it needs to be generated from
        # ``fullName`` for older add-ons
        self.manifest['name'] = self.harness_options.get('name',
                slugify(self.manifest['fullName']))
        # add default dependency
        self.manifest['dependencies'] = ['addon-kit', 'api-utils']

    def extract_packages(self, sdk_source_dir):
        """Builds SDK environment and calls the :method:`xpi.xpi_utils.build`

        :returns: temporary sdk_dir
        """

        def get_package_dir(dir_name, current_package_name):
            #returns the target path to the lib, data etc. dirs
            return os.path.join(sdk_dir, 'packages', current_package_name,
                    self.manifest[dir_name])

        # create temporary directory for SDK
        sdk_dir = tempfile.mkdtemp()
        for d in os.listdir(sdk_source_dir):
            s_d = os.path.join(sdk_source_dir, d)
            if os.path.isdir(s_d):
                shutil.copytree(s_d, os.path.join(sdk_dir, d))
            else:
                shutil.copy(s_d, sdk_dir)
        sdk_dependencies = ['addon-kit', 'api-utils']
        package_name = self.manifest['name']
        resource_dir_prefix = "resources/%s-" % (
                self.manifest['id'].split('@')[0].lower())
        # SDK 1.0 changed the resource naming convention
        resource_dir_prefix_1 = "resources/%s-" % (
                self.manifest['id'].lower().replace('@', '-at-'))
        # help lists to collect dependencies
        exporting = []
        dependencies = []

        def _extract(f, name, resource_dir_prefix):
            # extract only package files
            if name not in f or resource_dir_prefix not in f:
                return
            # get current package name from directory name (f)
            current_package_name = '-'.join(f.split(
                resource_dir_prefix)[1].split('/')[0].split('-')[:-1])
            # do not extract SDK libs
            if current_package_name in sdk_dependencies:
                return

            # create lib, data and tests directories
            if (current_package_name, name) not in exporting:
                # create appropriate directory
                os.makedirs(get_package_dir(name, current_package_name))
                exporting.append((current_package_name, name))

            if (current_package_name != package_name
                    and current_package_name not in dependencies):
                # collect info about exported dependencies
                dependencies.append(current_package_name)
                # export package.json
                try:
                    p_meta = self.harness_options['metadata'].get(
                        current_package_name, None)
                except Exception, err:
                    log.error("No metadata about dependency "
                            "(%s) required by (%s)\n%s" % (
                            current_package_name, package_name, str(err)))
                    return
                with open(os.path.join(sdk_dir, 'packages',
                    current_package_name, 'package.json'),
                        'w') as manifest:
                    manifest.write(simplejson.dumps(p_meta))

            # create aprropriate subdirectories and export files
            resource_dir = lambda x: "%s%s-%s/" % (
                    resource_dir_prefix, current_package_name, x)
            if f.startswith(resource_dir(name)) and f != resource_dir(name):
                f_name = "%s/%s" % (
                        get_package_dir(name, current_package_name),
                        f.split(resource_dir(name))[1])
                # if f is a directory, create it only
                if f.endswith('/'):
                    if not os.path.isdir(f_name):
                        os.makedirs(f_name)
                    return
                # if directory does not exist - cxreate it
                parent_dir = '/'.join(f_name.split('/')[:-1])
                if not os.path.isdir(parent_dir):
                    os.makedirs(parent_dir)
                # export file
                with open(f_name, 'w') as f_file:
                    f_file.write(self.xpi_zip.open(f).read())

        for f in self.xpi_zip.namelist():
            if resource_dir_prefix != resource_dir_prefix_1:
                if resource_dir_prefix_1 in f:
                    resource_dir_prefix = resource_dir_prefix_1
            for name in ['lib', 'data', 'tests']:
                _extract(f, name, resource_dir_prefix)
        # Add all dependencies to the manifest
        self.manifest['dependencies'].extend(dependencies)

        # create add-on's package.json
        with open(os.path.join(
                sdk_dir, 'packages', package_name, 'package.json'),
                'w') as manifest:
            manifest.write(simplejson.dumps(self.manifest))
        return sdk_dir

    def cleanup(self):
        """closes all files opened during the repackaging
        """
        self.xpi_zip.close()
        self.xpi_temp.close()
