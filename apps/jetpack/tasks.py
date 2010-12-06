import commonware.log

from celery.decorators import task

from jetpack import xpi_utils

log = commonware.log.getLogger('f.tasks')


@task(rate_limit='10/s')
def xpi_build(sdk_dir, package_dir):
    xpi_utils.xpi_build(sdk_dir, package_dir)
