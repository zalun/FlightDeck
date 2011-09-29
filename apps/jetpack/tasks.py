import datetime
import commonware.log
from celery.decorators import task

from .models import Package

log = commonware.log.getLogger('f.celery')

@task
def fill_package_activity(*args, **kwargs):
    """
    Collect all the revisions for each package, distinct by day, in the past year
    and determine the year of activity.
    """
    log.info('Inserting initial year_of_activity data.')
    pkgs = Package.objects.filter(deleted=False)
    now = datetime.datetime.utcnow()
    last_year = now - datetime.timedelta(365)

    for pkg in pkgs:
        revs = (pkg.revisions.filter(created_at__gte=last_year)
                .order_by('-created_at'))

        activity = list('0'*365)

        for rev in revs:
            day = (now - rev.created_at).days
            activity[day] = '1'

        pkg.year_of_activity = ''.join(activity)
        pkg.save()

    log.info('Finished filling year_of_activity.')

