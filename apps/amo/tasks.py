import commonware.log
import time
from statsd import statsd
from utils.exceptions import SimpleException

from celery.decorators import task

from jetpack.models import (PackageRevision,
        STATUS_UPLOAD_FAILED, STATUS_UPLOAD_SCHEDULED)
from utils.helpers import get_random_string
from xpi import xpi_utils


log = commonware.log.getLogger('f.celery')


@task
def upload_to_amo(rev_pk, hashtag=None):
    """Build XPI and upload to AMO
    Read result and save amo_id
    """
    tstart = time.time()
    if not hashtag:
        hashtag = get_random_string(10)
    revision = PackageRevision.objects.get(pk=rev_pk)
    # check if there this Add-on was uploaded with the same version name
    version = revision.get_version_name_only()
    uploaded = PackageRevision.objects.filter(
            package=revision.package).filter(
            amo_version_name=version).exclude(
            amo_status=None).exclude(
            amo_status=STATUS_UPLOAD_FAILED).exclude(
            amo_status=STATUS_UPLOAD_SCHEDULED)
    if len(uploaded) > 0:
        log.debug("This Add-on was already uploaded using version \"%s\"" % version)
        log.debug(revision.amo_status)
        raise SimpleException("This Add-on was already uploaded using version \"%s\"" % version)
    try:
        PackageRevision.objects.get(
            package=revision.package, amo_version_name=version,
            amo_status=STATUS_UPLOAD_SCHEDULED)
    except:
        pass
    else:
        log.debug("This Add-on is currently scheduled to upload")
        raise SimpleException("This Add-on is currently scheduled to upload")
    # save status
    revision.amo_status = STATUS_UPLOAD_SCHEDULED
    super(PackageRevision, revision).save()
    response = revision.build_xpi(
            hashtag=hashtag,
            tstart=tstart)
    # use created XPI
    revision.upload_to_amo(hashtag)
