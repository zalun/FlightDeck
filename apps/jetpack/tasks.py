import commonware.log

from celery.decorators import task

from utils import xpi

log = commonware.log.getLogger('f.tasks')


@task(rate_limit='10/s')
def xpi_build(sdk_dir, package_dir):
    xpi.build(sdk_dir, package_dir)
