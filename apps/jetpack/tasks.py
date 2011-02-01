from celery.decorators import task

from xpi import xpi_utils


@task(rate_limit='10/s')
def xpi_build(sdk_dir, package_dir, filename, hashtag):
    xpi_utils.build(sdk_dir, package_dir, filename, hashtag)
