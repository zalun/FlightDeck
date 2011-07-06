import commonware.log
import time
from statsd import statsd

from celery.decorators import task

from xpi import xpi_utils

from jetpack.models import PackageRevision

log = commonware.log.getLogger('f.celery')


@task(rate_limit='30/m')
def xpi_build_from_model(rev_pk, mod_codes={}, att_codes={}, hashtag=None, tqueued=None):
    """ Get object and build xpi
    """
    if not hashtag:
        log.critical("No hashtag provided")
        return
    tstart = time.time()
    if tqueued:
        tinqueue = (tstart - tqueued) * 1000
        statsd.timing('xpi.task.queued', tinqueue)
        log.info('[xpi:%s] Addon job picked from queue (%dms)' % (hashtag, tinqueue))
    revision = PackageRevision.objects.get(pk=rev_pk)
    # prepare changed modules and attachments
    modules = []
    attachments = []
    for mod in revision.modules.all():
        if str(mod.pk) in mod_codes:
            mod.code = mod_codes[str(mod.pk)]
            modules.append(mod)
    for att in revision.attachments.all():
        if str(att.pk) in att_codes:
            att.code = att_codes[str(att.pk)]
            attachments.append(att)
    revision.build_xpi(
            modules=modules,
            attachments=attachments,
            hashtag=hashtag,
            tstart=tstart)
