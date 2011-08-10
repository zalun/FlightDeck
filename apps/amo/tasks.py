import commonware.log
import time
from statsd import statsd

from celery.decorators import task

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
    response = revision.build_xpi(
            hashtag=hashtag,
            tstart=tstart)
    # use created XPI
    revision.upload_to_amo(hashtag)
