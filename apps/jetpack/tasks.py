import datetime
import commonware.log
from celery.decorators import task

from .models import Package

log = commonware.log.getLogger('f.celery')

@task
def fill_package_activity(full_year=False, *args, **kwargs):
    """
    Collect all the revisions for each package, distinct by day, in the past year
    and determine the year of activity.
    """
    log.info('Inserting data into year_of_activity.')
    pkgs = Package.objects.filter(deleted=False)
    now = datetime.datetime.utcnow()
    year = 365
    last_year = now - datetime.timedelta(year)

    for pkg in pkgs:
        if full_year or not pkg.activity_updated_at:
            days = year
            time_since = last_year
        else:
            time_since = pkg.activity_updated_at
            days = (now - time_since).days

        if days <= 0:
            continue

        revs = (pkg.revisions.filter(created_at__gte=time_since)
                .order_by('-created_at'))

        activity = list('0'*days)

        for rev in revs:
            day = (now - rev.created_at).days
            activity[day] = '1'


        activity = ''.join(activity)
        pkg.year_of_activity = activity + pkg.year_of_activity[:-days]
        pkg.activity_updated_at = now
        pkg.save()

    log.info('Finished filling data into year_of_activity.')

