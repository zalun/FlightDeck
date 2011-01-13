"""
a set of defs used to manage xpi
"""

import os
import shutil
import subprocess
import time
import commonware.log

from django.http import HttpResponseServerError
from django.conf import settings

log = commonware.log.getLogger('f.xpi_utils')


def sdk_copy(sdk_source, sdk_dir=None):
    shutil.copytree(sdk_source, sdk_dir)


def build(sdk_dir, package_dir, filename, hashtag):
    """Build xpi from source in sdk_dir."""
    # create XPI
    os.chdir(package_dir)
    cfx = [settings.PYTHON_EXEC, '%s/bin/cfx' % sdk_dir,
           '--binary=/usr/bin/xulrunner',
           '--keydir=%s/%s' % (sdk_dir, settings.KEYDIR), 'xpi']

    env = dict(PATH='%s/bin:%s' % (sdk_dir, os.environ['PATH']),
               VIRTUAL_ENV=sdk_dir,
               CUDDLEFISH_ROOT=sdk_dir,
               PYTHONPATH='%s/python-lib' % sdk_dir)
    try:
        process = subprocess.Popen(cfx, shell=False, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, env=env)
    except subprocess.CalledProcessError:
        return HttpResponseServerError

    response = process.communicate()

    # move the XPI created to the XPI_TARGETDIR
    xpi_targetfilename = "%s.xpi" % hashtag
    xpi_targetpath = os.path.join(settings.XPI_TARGETDIR, xpi_targetfilename)
    xpi_path = os.path.join(package_dir, "%s.xpi" % filename)
    shutil.copy(xpi_path, xpi_targetpath)
    shutil.rmtree(sdk_dir)

    ret = [xpi_targetfilename]
    ret.extend(response)
    log.info('Created: %s' % xpi_targetpath)
    return ret


def remove(path):
    " clear directory "
    os.remove(path)
