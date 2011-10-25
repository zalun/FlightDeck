#
# !!AUTO-GENERATED!!  Edit scripts/crontab/crontab.tpl instead.
#
MAILTO=flightdeck-developers@mozilla.org

#every hour
30 * * * * {{ crons.django }} celery

#once per day
30 1 * * * {{ crons.django }} gc
30 2 * * * {{ crons.django }} update_package_activity

MAILTO=root
