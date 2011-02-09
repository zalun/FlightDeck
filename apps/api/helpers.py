import os
import subprocess

from django.conf import settings

def export_docs(sdk_dir):
    # export docs
    os.chdir(sdk_dir)
    cfx = [settings.PYTHON_EXEC, '%s/bin/cfx' % sdk_dir,
           '--binary=/usr/bin/xulrunner', 'sdocs']
    env = dict(PATH='%s/bin:%s' % (sdk_dir, os.environ['PATH']),
               VIRTUAL_ENV=sdk_dir,
               CUDDLEFISH_ROOT=sdk_dir,
               PYTHONPATH='%s/python-lib' % sdk_dir)
    process = subprocess.Popen(cfx, shell=False, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, env=env)
    return process.communicate()
