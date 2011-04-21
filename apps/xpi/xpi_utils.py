""" a set of defs used to manage xpi
"""

import collections
import os
import rdflib
import re
import shutil
import subprocess
import tempfile
import time
import urllib
import zipfile

import commonware.log

from django.http import HttpResponseServerError, HttpResponseForbidden
from django.conf import settings
from django.utils.translation import ugettext as _

log = commonware.log.getLogger('f.xpi_utils')


def sdk_copy(sdk_source, sdk_dir=None):
    log.debug("Copying tree (%s) to (%s)" % (sdk_source, sdk_dir))
    shutil.copytree(sdk_source, sdk_dir)


def build(sdk_dir, package_dir, filename, hashtag):
    """Build xpi from source in sdk_dir."""

    t1 = time.time()

    # create XPI
    os.chdir(package_dir)

    # @TODO xulrunner should be a config variable
    cfx = [settings.PYTHON_EXEC, '%s/bin/cfx' % sdk_dir,
           '--binary=/usr/bin/xulrunner',
           '--keydir=%s/%s' % (sdk_dir, settings.KEYDIR), 'xpi']

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
        return HttpResponseServerError
    if response[1]:
        log.critical("Failed to build xpi.\nError: %s" % response[1])
        return HttpResponseForbidden(response[1])

    # move the XPI created to the XPI_TARGETDIR
    xpi_targetfilename = "%s.xpi" % hashtag
    xpi_targetpath = os.path.join(settings.XPI_TARGETDIR, xpi_targetfilename)
    xpi_path = os.path.join(package_dir, "%s.xpi" % filename)
    log.debug(response)
    log.debug("%s, %s" % (xpi_path, xpi_targetpath))
    shutil.copy(xpi_path, xpi_targetpath)
    shutil.rmtree(sdk_dir)

    ret = [xpi_targetfilename]
    ret.extend(response)

    t2 = time.time()

    log.info('[xpi:%s] Created xpi: %s (time: %0.3fms)' % (hashtag,
                                                           xpi_targetpath,
                                                           ((t2 - t1) * 1000)))

    return ret


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

VERSION_RE = re.compile('^[-+*.\w]{,32}$')

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
    ADDON_EXTENSION = 1

    def __init__(self, install_rdf):
        self.rdf = rdflib.Graph().parse(install_rdf)
        self.find_root()
        self.data = {
            'guid': self.find('id'),
            'type': self.find('type') or self.ADDON_EXTENSION,
            'name': self.find('name'),
            'version': self.find('version'),
            'homepage': self.find('homepageURL'),
            'summary': self.find('description'),
            'no_restart': self.find('bootstrap') == 'true',
            'apps': self.App(appdata=FIREFOX, id=FIREFOX.id, min='4.0', max='4.1'),
        }
        log.debug(str(self.data))

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

    AMO_PREFIX = "http://piotr.zalewa.info/downloads/"

    def __init__(self, amo_id, amo_file, sdk, hashtag):
        # validate entries
        # prepare data
        self.amo_id = amo_id
        self.amo_file = amo_file
        self.sdk = sdk
        self.hashtag = hashtag
        # pull xpi from AMO and unpack it
        xpi_remote = urllib.urlopen(self._get_amo_url())
        self.xpi_temp = tempfile.TemporaryFile()
        self.xpi_temp.write(xpi_remote.read())
        self.xpi_zip = zipfile.ZipFile(self.xpi_temp)
        xpi_remote.close()

    def _get_amo_url(self):
        return "%s%s/%s.xpi" % (self.AMO_PREFIX, self.amo_id, self.amo_file)

    def destroy(self):
        self.xpi_zip.close()
        self.xpi_temp.close()

    def get_manifest(self):
        install_rdf = self.xpi_zip.open('install.rdf')
        log.debug(install_rdf)
        extr = Extractor(install_rdf)


