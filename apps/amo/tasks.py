import commonware.log
import time
from statsd import statsd
from utils.exceptions import SimpleException

from celery.decorators import task

from amo.constants import *
from jetpack.models import PackageRevision
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
    # save status
    log.debug("[%s] upload - Saving status")
    revision.amo_status = STATUS_UPLOAD_SCHEDULED
    revision.amo_version_name = revision.get_version_name()
    super(PackageRevision, revision).save()
    log.debug("[%s] upload - Building XPI")
    response = revision.build_xpi(
            hashtag=hashtag,
            tstart=tstart)
    # use created XPI
    log.debug("[%s] upload - XPI built - uploading")
    revision.upload_to_amo(hashtag)
    log.debug("[%s] upload finished")
