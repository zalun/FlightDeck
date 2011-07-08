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
from statsd import statsd

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


def sdk_copy(sdk_source, sdk_dir):
    log.debug("Copying SDK from (%s) to (%s)" % (sdk_source, sdk_dir))
    with statsd.timer('xpi.copy'):
        if os.path.isdir(sdk_dir):
            for d in os.listdir(sdk_source):
                s_d = os.path.join(sdk_source, d)
                if os.path.isdir(s_d):
                    shutil.copytree(s_d, os.path.join(sdk_dir, d))
                else:
                    shutil.copy(s_d, sdk_dir)
        else:
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
        log.critical("[xpi:%s] Failed to build xpi: %s.  Command(%s)" % (
                     hashtag, str(err), cfx))
        shutil.rmtree(sdk_dir)
        raise
    if response[1]:
        info_write(info_targetpath, 'error', response[1], hashtag)
        log.critical("[xpi:%s] Failed to build xpi." % hashtag)
        shutil.rmtree(sdk_dir)
        return response

    t2 = time.time()

    # XPI: move the XPI created to the XPI_TARGETDIR (local to NFS)
    xpi_path = os.path.join(package_dir, "%s.xpi" % filename)
    xpi_targetfilename = "%s.xpi" % hashtag
    xpi_targetpath = os.path.join(settings.XPI_TARGETDIR, xpi_targetfilename)
    shutil.copy(xpi_path, xpi_targetpath)
    shutil.rmtree(sdk_dir)

    ret = [xpi_targetfilename]
    ret.extend(response)

    t3 = time.time()
    copy_xpi_time = (t3 - t2) * 1000
    build_time = (t2 - t1) * 1000
    preparation_time = ((t1 - tstart) * 1000) if tstart else 0

    statsd.timing('xpi.build.prep', preparation_time)
    statsd.timing('xpi.build.build', build_time)
    statsd.timing('xpi.build.copyresult', copy_xpi_time)
    log.info('[xpi:%s] Created xpi: %s (prep time: %dms) (build time: %dms) '
             '(copy xpi time: %dms)' % (hashtag, xpi_targetpath,
                                        preparation_time, build_time,
                                        copy_xpi_time))

    info_write(info_targetpath, 'success', response[0], hashtag)

    return response


def remove(path):
    " clear directory "
    log.debug("Removing directory (%s)" % path)
    os.remove(path)

def get_queued_cache_key(hashtag, request=None):
    session = request.session.session_key if request else None
    key = 'xpi:timing:queued:%s:%s' % (hashtag, session)
    return key
