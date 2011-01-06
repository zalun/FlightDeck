import os
import stat
import time

from django.conf import settings

import commonware
import cronjobs

length = 60 * 60 * 24  # one day
log = commonware.log.getLogger('f.cron')


def find_files():
    files = []
    tmp_dir = settings.XPI_TARGETDIR
    for filename in os.listdir(tmp_dir):
        full = os.path.join(tmp_dir, filename)
        if os.path.isfile(full) and full.endswith("xpi"):
            files.append(full)
    return files


@cronjobs.register
def clean_tmp(length=length):
    older = time.time() - length
    for filename in find_files():
        if os.stat(filename)[stat.ST_MTIME] < older:
            os.remove(filename)
            log.info('Deleted: %s' % filename)
