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
    log.debug("Copying SDK from (%s) to (%s)" % (sdk_source, sdk_dir))
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

