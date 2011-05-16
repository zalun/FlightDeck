import commonware.log

from celery.decorators import task

from xpi import xpi_utils

from jetpack.models import PackageRevision

log = commonware.log.getLogger('f.repackage.tasks')


@task(rate_limit='30/m')
def download_and_rebuild(amo_id, amo_file, sdk_source_dir, hashtag,
        target_version=None):
    """creates a Repackage instance, downloads xpi and rebuilds it

    :param: amo_id (Integer) id of the package in AMO (translates to
            direcory in ``ftp://ftp.mozilla.org/pub/mozilla.org/addons/``)
    :param: amo_file (String) filename of the XPI to download
    :param: sdk_source_dir (String) absolute path of the SDK
    :param: hashtag (String) filename for the buid XPI
    :param: target_version (String)
    """
    rep = Repackage()
    rep.download(amo_id, amo_file)
    rep.rebuild(sdk_source_dir, hashtag, target_version)

