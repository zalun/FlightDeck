import commonware.log

from celery.decorators import task

from xpi import xpi_utils

log = commonware.log.getLogger('f.tasks')


@task(rate_limit='10/s')
def xpi_build(sdk_dir, package_dir, filename):
    xpi_utils.build(sdk_dir, package_dir, filename)
