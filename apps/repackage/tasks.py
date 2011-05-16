import commonware.log

from celery.decorators import task

from xpi import xpi_utils

from jetpack.models import PackageRevision

log = commonware.log.getLogger('f.repackage.tasks')


@task(rate_limit='30/m')
def download_and_rebuild(amo_id, amo_file, sdk_source_dir, hashtag, target_version):
    #rep = xpi_utils.Repackage(
    #        amo_id, amo_file, sdk_source_dir, hashtag, target_version)
    #response = rep.build_xpi()
    #rep.destroy()
    rep = Repackage()
    rep.download(amo_id, amo_file)
    rep.rebuild(sdk_source_dir, hashtag, target_version)

