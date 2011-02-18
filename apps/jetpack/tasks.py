import commonware

from celery.decorators import task

from xpi import xpi_utils

log = commonware.log.getLogger('f.celery')


@task(rate_limit='30/m')
def xpi_build(sdk_dir, package_dir, filename, hashtag):
    log.info('[1@%s] Building XPI: %s' % (xpi_build.rate_limit, filename))
    xpi_utils.build(sdk_dir, package_dir, filename, hashtag)
