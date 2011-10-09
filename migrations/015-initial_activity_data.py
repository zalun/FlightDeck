"""
Collect all the revisions for each package, distinct by day, in the past year
and determine the year of activity.
"""
from jetpack.cron import fill_package_activity

def run(*args, **kwargs):
    fill_package_activity()

