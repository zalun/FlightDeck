import commonware.log

from celery.decorators import task

from xpi import xpi_utils

from jetpack.models import PackageRevision

log = commonware.log.getLogger('f.celery')


@task(rate_limit='30/m')
def xpi_build(sdk_dir, package_dir, filename, hashtag):
    log.info('[1@%s] Building XPI: %s' % (xpi_build.rate_limit, filename))
    xpi_utils.build(sdk_dir, package_dir, filename, hashtag)

@task(rate_limit='30/m')
def xpi_build_from_model(rev_pk, mod_codes={}, att_codes={}, hashtag=None):
    """ Get object and build xpi
    """
    if not hashtag:
        log.critical("No hashtag provided")
        return
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
            hashtag=hashtag)
