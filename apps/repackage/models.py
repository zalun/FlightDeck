"""
repackage.models
----------------
"""
import os
import shutil
import simplejson
import tempfile
import urllib
import zipfile

import commonware.log

from django.conf import settings
from django.http import Http404
from django.template.defaultfilters import slugify

from base.models import BaseModel
from xpi import xpi_utils

from repackage.helpers import Extractor

log = commonware.log.getLogger('f.packager')


class Repackage(BaseModel):

    def download(self, amo_id, amo_file):
        """Downloads the XPI (from address build with
        ``settings.XPI_AMO_PREFIX``, ``amo_id`` and ``amo_file``) and
        instantiates XPI in ``self.xpi_zip``

        This eventually will record statistics about build times

        :param: amo_id (Integer) id of the package in AMO (translates to
                direcory in ``ftp://ftp.mozilla.org/pub/mozilla.org/addons/``)
        :param: amo_file (String) filename of the XPI to download
        :param: target_version (String)

        :returns: None
        """

        amo_url = "%s%s/%s.xpi" % (settings.XPI_AMO_PREFIX, amo_id, amo_file)
        try:
            xpi_remote_file = urllib.urlopen(amo_url)
        except IOError:
            log.info("Wrong url provided (%s)" % amo_url)
            raise Http404
        # zipfile doesn't work on the urllib filelike entities
        self.xpi_temp = tempfile.TemporaryFile()
        self.xpi_temp.write(xpi_remote_file.read())
        self.xpi_zip = zipfile.ZipFile(self.xpi_temp)
        xpi_remote_file.close()

    def rebuild(self, sdk_source_dir, hashtag, target_version=None):
        """Drive the rebuild process

        :param: sdk_source_dir (String) absolute path of the SDK
        :param: hashtag (String) filename for the buid XPI
        :param: target_version (String)
        """
        self.get_manifest(target_version=target_version)
        sdk_dir = self.extract_packages(sdk_source_dir)
        # build xpi
        response = xpi_utils.build(sdk_dir,
                os.path.join(sdk_dir, 'packages', self.manifest['name']),
                self.manifest['name'], hashtag)
        # clean up (sdk_dir is already removed)
        self.cleanup()
        return response

    def get_manifest(self, target_version=None):
        """extracts manifest from ``install.rdf`` it does not contain all
        dependencies, these will be appended during copying package files

        Sets the ``self.manifest`` field
        """
        # extract data provided in install.rdf
        install_rdf = self.xpi_zip.open('install.rdf')
        extracted = Extractor(install_rdf)
        self.manifest = extracted.read_manifest(target_version=target_version)
        # get data provided by harness-options.json
        with self.xpi_zip.open('harness-options.json') as ho_json:
            self.harness_options = simplejson.loads(ho_json.read())
        # ``name`` is provided since SDK 1.0b2, it needs to be generated from
        # ``fullName`` for older add-ons
        self.manifest['name'] = self.harness_options.get('name',
                slugify(self.manifest['fullName']))
        # add default dependency
        self.manifest['dependencies'] = ['addon-kit']

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
        resource_dir_prefix = "resources/%s-" % self.manifest['id'].split('@')[0].lower()
        # help lists to collect dependencies
        exporting = []
        dependencies = []

        def extract(f, name):
            # extract only package files
            if  name not in f:
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
            for name in ['lib', 'data', 'tests']:
                extract(f, name)
        # Add all dependencies to the manifest
        self.manifest['dependencies'].extend(dependencies)

        # create add-on's package.json
        with open(os.path.join(sdk_dir, 'packages', package_name, 'package.json'), 'w') as manifest:
            manifest.write(simplejson.dumps(self.manifest))
        return sdk_dir

    def cleanup(self):
        """closes all files opened during the repackaging
        """
        self.xpi_zip.close()
        self.xpi_temp.close()
