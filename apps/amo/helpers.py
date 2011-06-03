import commonware.log
from django.conf import settings

log = commonware.log.getLogger('f.authentication')

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

