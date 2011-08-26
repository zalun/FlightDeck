import commonware.log
import simplejson

from django.shortcuts import render_to_response
from django.http import HttpResponse, HttpResponseNotAllowed, HttpResponseBadRequest

from amo import tasks
from amo.helpers import get_addon_details as _get_addon_details
from jetpack.models import (PackageRevision,
        STATUS_UPLOAD_FAILED, STATUS_UPLOAD_SCHEDULED)
from utils.exceptions import SimpleException

log = commonware.log.getLogger('f.amo')


def upload_to_amo(request, pk):
    """Upload a XPI to AMO
    """
    # check if there this Add-on was uploaded with the same version name
    revision = PackageRevision.objects.get(pk=pk)
    version = revision.get_version_name()
    uploaded = PackageRevision.objects.filter(
            package=revision.package).filter(
            amo_version_name=version).exclude(
            amo_status=None).exclude(
            amo_status=STATUS_UPLOAD_FAILED).exclude(
            amo_status=STATUS_UPLOAD_SCHEDULED)
    if len(uploaded) > 0:
        log.debug("This Add-on was already uploaded using version \"%s\"" % version)
        log.debug(revision.amo_status)
        return HttpResponseBadRequest("This Add-on was already uploaded using version \"%s\"" % version)
    try:
        PackageRevision.objects.get(
            package=revision.package, amo_version_name=version,
            amo_status=STATUS_UPLOAD_SCHEDULED)
    except:
        pass
    else:
        log.debug("This Add-on is currently scheduled to upload")
        return HttpResponseBadRequest("This Add-on is currently scheduled to upload")
    log.debug('AMOOAUTH: Scheduling upload to AMO')
    tasks.upload_to_amo.delay(pk)
    return HttpResponse('{"delayed": true}')


def get_addon_details(request, pk):
    """ Finds latest revision uploaded to AMO and pulls metadata from AMO
    using `generic AMO API <https://developer.mozilla.org/en/addons.mozilla.org_%28AMO%29_API_Developers%27_Guide/The_generic_AMO_API>`_

    :attr: pk (int) :class:`~jetpack.models.PackageRevision` primary key
    :returns: add-on metadata or empty dict in JSON format
    """
    # get PackageRevision
    revision = PackageRevision.objects.get(pk=pk)
    # check if Package is synced with the AMO
    if not revision.package.amo_id:
        return HttpResponse('{}', mimetype="application/json")
    # pull info
    amo_meta = _get_addon_details(revision.package.amo_id)
    return HttpResponse(simplejson.dumps(amo_meta),
                        mimetype="application/json")
