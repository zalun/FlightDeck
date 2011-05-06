""" a set of defs used to manage xpi
"""

import collections
import os
import rdflib
import re
import shutil
import simplejson
import subprocess
import tempfile
import time
import urllib
import zipfile

import commonware.log

from django.http import Http404, HttpResponseServerError, HttpResponseForbidden
from django.conf import settings
from django.template.defaultfilters import slugify
from django.utils.translation import ugettext as _

log = commonware.log.getLogger('f.xpi_utils')


def sdk_copy(sdk_source, sdk_dir=None):
    log.debug("Copying tree (%s) to (%s)" % (sdk_source, sdk_dir))
    shutil.copytree(sdk_source, sdk_dir)

def hack_guid(xpi_path, guid):
    original_xpi = zipfile.ZipFile(xpi_path)
    temp_xpi_path = '%s-temp' % xpi_path
    target_xpi = zipfile.ZipFile(temp_xpi_path, mode='a')
    # get temp guid
    original_extr = Extractor(original_xpi.open('install.rdf'))
    # TODO: check if it's a JetPack addon
    temp_guid = original_extr.guid

    # change install.rdf and harness-options.json
    for f in original_xpi.namelist():
        if f in ('install.rdf', 'harness-options.json'):
            target_xpi.writestr(f, original_xpi.read(f).replace(temp_guid, guid))
        else:
            f_name = f.replace(temp_guid, guid)
            target_xpi.writestr(f_name, original_xpi.read(f))

    original_xpi.close()
    target_xpi.close()
    os.remove(xpi_path)
    shutil.copy(temp_xpi_path, xpi_path)
    os.remove(temp_xpi_path)

def build(sdk_dir, package_dir, filename, hashtag, force_guid=None):
    """Build xpi from source in sdk_dir."""

    log.debug([sdk_dir, package_dir, filename, hashtag])

    t1 = time.time()

    # create XPI
    os.chdir(package_dir)
    log.debug('changing url to %s' % package_dir)

    # @TODO xulrunner should be a config variable
    cfx = [settings.PYTHON_EXEC, '%s/bin/cfx' % sdk_dir,
           '--binary=/usr/bin/xulrunner',
           '--keydir=%s/%s' % (sdk_dir, settings.KEYDIR), 'xpi']

    log.debug(cfx)

    env = dict(PATH='%s/bin:%s' % (sdk_dir, os.environ['PATH']),
               VIRTUAL_ENV=sdk_dir,
               CUDDLEFISH_ROOT=sdk_dir,
               PYTHONPATH=os.path.join(sdk_dir, 'python-lib'))
    try:
        process = subprocess.Popen(cfx, shell=False, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, env=env)
        response = process.communicate()
    except subprocess.CalledProcessError:
        log.critical("Failed to build xpi: %s.  Command(%s)" % (
                     subprocess.CalledProcessError, cfx))
        return subprocess.CalledProcessError
    if response[1] and not force_guid:
        log.critical("Failed to build xpi.\nError: %s" % response[1])
        return response[1]

    log.debug(response)

    xpi_path = os.path.join(package_dir, "%s.xpi" % filename)

    if force_guid:
        # XXX: This is a hack - it is ugly in code and execution
        try:
            process = subprocess.Popen(cfx, shell=False, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, env=env)
            response = process.communicate()
        except subprocess.CalledProcessError:
            log.critical("Failed to build xpi: %s.  Command(%s)" % (
                         subprocess.CalledProcessError, cfx))
            return subprocess.CalledProcessError
        if response[1]:
            log.critical("Failed to build xpi.\nError: %s" % response[1])
            return response[1]
        hack_guid(xpi_path, force_guid)

    # move the XPI created to the XPI_TARGETDIR
    xpi_targetfilename = "%s.xpi" % hashtag
    xpi_targetpath = os.path.join(settings.XPI_TARGETDIR, xpi_targetfilename)
    log.debug("%s, %s" % (xpi_path, xpi_targetpath))
    shutil.copy(xpi_path, xpi_targetpath)
    shutil.rmtree(sdk_dir)

    ret = [xpi_targetfilename]
    ret.extend(response)

    t2 = time.time()

    log.info('[xpi:%s] Created xpi: %s (time: %0.3fms)' % (hashtag,
                                                           xpi_targetpath,
                                                           ((t2 - t1) * 1000)))

    return None


def remove(path):
    " clear directory "
    log.debug("Removing directory (%s)" % path)
    os.remove(path)

########### zamboni / apps / versions / compare.py

version_re = re.compile(r"""(?P<major>\d+) # major (x in x.y)
\.(?P<minor1>\d+) # minor1 (y in x.y)
\.?(?P<minor2>\d+|\*)? # minor2 (z in x.y.z)
\.?(?P<minor3>\d+|\*)? # minor3 (w in x.y.z.w)
(?P<alpha>[a|b]?) # alpha/beta
(?P<alpha_ver>\d*) # alpha/beta version
(?P<pre>pre)? # pre release
(?P<pre_ver>\d)? # pre release version""",
                        re.VERBOSE)


def dict_from_int(version_int):
    """Converts a version integer into a dictionary with major/minor/...
info."""
    d = {}
    rem = version_int
    (rem, d['pre_ver']) = divmod(rem, 100)
    (rem, d['pre']) = divmod(rem, 10)
    (rem, d['alpha_ver']) = divmod(rem, 100)
    (rem, d['alpha']) = divmod(rem, 10)
    (rem, d['minor3']) = divmod(rem, 100)
    (rem, d['minor2']) = divmod(rem, 100)
    (rem, d['minor1']) = divmod(rem, 100)
    (rem, d['major']) = divmod(rem, 100)
    d['pre'] = None if d['pre'] else 'pre'
    d['alpha'] = {0: 'a', 1: 'b'}.get(d['alpha'])

    return d


def version_dict(version):
    """Turn a version string into a dict with major/minor/... info."""
    match = version_re.match(version or '')
    letters = 'alpha pre'.split()
    numbers = 'major minor1 minor2 minor3 alpha_ver pre_ver'.split()
    if match:
        d = match.groupdict()
        for letter in letters:
            d[letter] = d[letter] if d[letter] else None
        for num in numbers:
            if d[num] == '*':
                d[num] = 99
            else:
                d[num] = int(d[num]) if d[num] else None
    else:
        d = dict((k, None) for k in numbers)
        d.update((k, None) for k in letters)
    return d


def version_int(version):
    d = version_dict(str(version))
    for key in ['alpha_ver', 'major', 'minor1', 'minor2', 'minor3',
                'pre_ver']:
        if not d[key]:
            d[key] = 0
    atrans = {'a': 0, 'b': 1}
    d['alpha'] = atrans.get(d['alpha'], 2)
    d['pre'] = 0 if d['pre'] else 1

    v = "%d%02d%02d%02d%d%02d%d%02d" % (d['major'], d['minor1'],
            d['minor2'], d['minor3'], d['alpha'], d['alpha_ver'], d['pre'],
            d['pre_ver'])
    return int(v)


###########

class FIREFOX:
    id = 1
    shortername = 'fx'
    short = 'firefox'
    pretty = _(u'Firefox')
    browser = True
    types = [1]
    guid = '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}'
    min_display_version = 3.0
    # These versions were relabeled and should not be displayed.
    exclude_versions = (3.1, 3.7)
    backup_version = version_int('3.7.*')
    user_agent_string = 'Firefox'

class Extractor(object):
    """Extract add-on info from an install.rdf."""
    App = collections.namedtuple('App', 'appdata id min max')
    manifest = u'urn:mozilla:install-manifest'
    ADDON_EXTENSION ='2'

    def __init__(self, install_rdf):
        self.rdf = rdflib.Graph().parse(install_rdf)
        self.find_root()
        # TODO: check if it's a JetPack addon
        self.guid = self.find('id')

    def read_manifest(self):
        data = {
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
        self.data = {}
        for key, value in data.items():
            if value:
                self.data[key] = value


    @classmethod
    def parse(cls, install_rdf):
        return cls(install_rdf).data

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

    def apps(self):
        rv = []
        for ctx in self.rdf.objects(None, self.uri('targetApplication')):
            app = FIREFOX
            try:
                qs = AppVersion.objects.filter(application=app.id)
                min = qs.get(version=self.find('minVersion', ctx))
                max = qs.get(version=self.find('maxVersion', ctx))
            except AppVersion.DoesNotExist:
                continue
            rv.append(self.App(appdata=app, id=app.id, min=min, max=max))
        return rv



class Repackage:


    def __init__(self, amo_id, amo_file, sdk, hashtag, target_version):
        # validate entries
        # prepare data
        self.amo_id = amo_id
        self.amo_file = amo_file
        self.sdk = sdk
        self.hashtag = hashtag
        self.target_version = target_version
        # pull xpi from AMO and unpack it
        try:
            xpi_remote = urllib.urlopen(self._get_amo_url())
        except IOError:
            log.info("Wrong url provided (%s)" % self._get_amo_url())
            raise Http404
        self.xpi_temp = tempfile.TemporaryFile()
        self.xpi_temp.write(xpi_remote.read())
        self.xpi_zip = zipfile.ZipFile(self.xpi_temp)
        xpi_remote.close()
        self.read_rdf()

    def _get_amo_url(self):
        return "%s%s/%s.xpi" % (settings.XPI_AMO_PREFIX, self.amo_id, self.amo_file)

    def destroy(self):
        self.xpi_zip.close()
        self.xpi_temp.close()

    def read_rdf(self):
        install_rdf = self.xpi_zip.open('install.rdf')
        self.install_rdf = Extractor(install_rdf)
        self.install_rdf.read_manifest()
        self.guid = self.install_rdf.guid
        if self.target_version:
            self.install_rdf.data['version'] = self.target_version
        harness_options_json = self.xpi_zip.open('harness-options.json')
        self.harness_options = simplejson.loads(harness_options_json.read())
        # read name from harness options, generate it from fullName if none
        self.install_rdf.data['name'] = self.harness_options.get('name',
                slugify(self.install_rdf.data['fullName']))
        self.install_rdf.data['dependencies'] = ['addon-kit']

    def build_xpi(self):
        sdk_dependencies = ['addon-kit', 'api-utils']
        package_name = self.install_rdf.data['name']
        # XXX: this should use a tempfile
        sdk_dir = os.path.join(settings.SDKDIR_PREFIX, self.hashtag)

        def get_package_dir(dir_name, current_package_name):
            return os.path.join(sdk_dir, 'packages', current_package_name,
                    self.install_rdf.data[dir_name])

        resource_dir_prefix = "resources/%s-" % self.guid.split('@')[0].lower()
        # copy sdk
        sdk_copy(self.sdk.get_source_dir(), sdk_dir)
        # extract packages
        exporting = []
        dependencies = []
        def extract(f, name):
            # extract only package files
            if  name not in f:
                return
            # get current package name from directory name (f)
            current_package_name = '-'.join(f.split(resource_dir_prefix)[1].split('/')[0].split('-')[:-1])
            # do not extract SDK libs
            if current_package_name in sdk_dependencies:
                return

            # create lib, data and tests directories
            if (current_package_name, name) not in exporting:
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
            extract(f, 'lib')
            extract(f, 'data')
            extract(f, 'tests')
        self.install_rdf.data['dependencies'].extend(dependencies)

        log.debug(self.install_rdf.data)
        # create package.json
        with open(os.path.join(sdk_dir, 'packages', package_name, 'package.json'), 'w') as manifest:
            manifest.write(simplejson.dumps(self.install_rdf.data))
        # extract dependencies
        self.sdk_dir = sdk_dir
        return build(self.sdk_dir,
                os.path.join(sdk_dir, 'packages', package_name),
                self.install_rdf.data['name'], self.hashtag, self.guid)

