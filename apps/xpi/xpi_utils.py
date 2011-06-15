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


def info_write(path, status, message, hashtag=None):
    data = {
        'status': status,
        'message': str(message)}
    if hashtag:
        data['hashtag'] = hashtag
    with open(path, 'w') as info:
        info.write(simplejson.dumps(data))


def sdk_copy(sdk_source, sdk_dir=None):
    log.debug("Copying SDK from (%s) to (%s)" % (sdk_source, sdk_dir))
    shutil.copytree(sdk_source, sdk_dir)


def build(sdk_dir, package_dir, filename, hashtag, tstart=None):
    """Build xpi from SDK with prepared packages in sdk_dir.

    :params:
        * sdk_dir (String) SDK directory
        * package_dir (string) dir of the Add-on package
        * filename (string) XPI will be build with this name
        * hashtag (string) XPI will be copied to a file which name is creted
          using the unique hashtag
        * t1 (integer) time.time() of the process started

    :returns: (list) ``cfx xpi`` response where ``[0]`` is ``stdout`` and
              ``[1]`` ``stderr``
    """

    t1 = time.time()

    # create XPI
    os.chdir(package_dir)

    # @TODO xulrunner should be a config variable
    cfx = [settings.PYTHON_EXEC, '%s/bin/cfx' % sdk_dir,
           '--binary=/usr/bin/xulrunner',
           '--keydir=%s/%s' % (sdk_dir, settings.KEYDIR), 'xpi']

    log.debug(cfx)

    info_targetfilename = "%s.json" % hashtag
    info_targetpath = os.path.join(settings.XPI_TARGETDIR, info_targetfilename)

    env = dict(PATH='%s/bin:%s' % (sdk_dir, os.environ['PATH']),
               VIRTUAL_ENV=sdk_dir,
               CUDDLEFISH_ROOT=sdk_dir,
               PYTHONPATH=os.path.join(sdk_dir, 'python-lib'))
    try:
        process = subprocess.Popen(cfx, shell=False, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, env=env)
        response = process.communicate()
    except subprocess.CalledProcessError, err:
        info_write(info_targetpath, 'error', str(err), hashtag)
        log.critical("Failed to build xpi: %s.  Command(%s)" % (
                     str(err), cfx))
        raise
    if response[1]:
        info_write(info_targetpath, 'error', response[1], hashtag)
        log.critical("Failed to build xpi.\nError: %s" % response[1])
        return response

    # move the XPI created to the XPI_TARGETDIR
    xpi_path = os.path.join(package_dir, "%s.xpi" % filename)
    xpi_targetfilename = "%s.xpi" % hashtag
    xpi_targetpath = os.path.join(settings.XPI_TARGETDIR, xpi_targetfilename)
    shutil.copy(xpi_path, xpi_targetpath)
    shutil.rmtree(sdk_dir)

    ret = [xpi_targetfilename]
    ret.extend(response)

    t2 = time.time()

    log.info('[xpi:%s] Created xpi: %s (time: %0.3fms)' % (
        hashtag, xpi_targetpath, ((t2 - t1) * 1000)))

    info_write(info_targetpath, 'success', response[0], hashtag)

    return response


def remove(path):
    " clear directory "
    log.debug("Removing directory (%s)" % path)
    os.remove(path)

