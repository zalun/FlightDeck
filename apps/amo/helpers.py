import commonware.log
from django.conf import settings
from lxml import etree
import urllib2

log = commonware.log.getLogger('f.amo')


def get_addon_amo_api_url(id, file_id):
    """provides URL for AMO addon info API

    :attr: id (int) add-on's id in AMO
    :attr: file_id (int) version identified by file id in AMO
    """
    url = "%s://%s/api/%s/addon/%d" % (
        settings.AMOAPI_PROTOCOL, settings.AMOAPI_DOMAIN,
        settings.AMOAPI_VERSION, id)
    if file_id:
        url = "%s/%d" % (url, file_id)
    return url


def get_amo_cursor():
    import MySQLdb
    try:
        auth_conn = MySQLdb.connect(
            host=settings.AUTH_DATABASE['HOST'],
            user=settings.AUTH_DATABASE['USER'],
            passwd=settings.AUTH_DATABASE['PASSWORD'],
            db=settings.AUTH_DATABASE['NAME'])
    except Exception, err:
        log.critical("Authentication database connection failure: %s"
                % str(err))
        raise
    return auth_conn.cursor()

def get_addon_details(amo_id, amo_file_id=None):
    """Pull metadata from AMO using `generic AMO API
    <https://developer.mozilla.org/en/addons.mozilla.org_%28AMO%29_API_Developers%27_Guide/The_generic_AMO_API>`_

    :attr: amo_id (int) id of the add-on in AMO
    :attr: amo_file_id (int) id of the file uploaded to AMO
    :returns: dict
    """
    url = get_addon_amo_api_url(amo_id, amo_file_id)
    log.debug("AMOAPI: receiving add-on info from \"%s\"" % url)
    req = urllib2.Request(url)
    try:
        page = urllib2.urlopen(req, timeout=settings.URLOPEN_TIMEOUT)
    except Exception, error:
        msg = "AMOAPI: ERROR receiving add-on info from \"%s\"%s%s"
        log.critical(msg % (url, '\n', str(error)))
        return {'error': msg % (url, ' : ', str(error))}
    amo_xml = etree.fromstring(page.read())
    amo_data = {}
    for element in amo_xml.iter():
        if element.tag in ('status', 'rating', 'version'):
            amo_data[element.tag] = element.text
    # return dict
    return amo_data
