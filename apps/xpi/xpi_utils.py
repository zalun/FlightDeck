"""
a set of defs used to manage xpi
"""

import os
import shutil
import subprocess
import stat

from django.http import HttpResponseServerError
from django.conf import settings


def sdk_copy(sdk_source, sdk_dir=None):
    shutil.copytree(sdk_source, sdk_dir)


def build(sdk_dir, package_dir):
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
    return process.communicate()


def remove(sdk_dir):
    " clear directory "
    shutil.rmtree(sdk_dir)
