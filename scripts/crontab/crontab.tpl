#
# !!AUTO-GENERATED!!  Edit scripts/crontab/crontab.tpl instead.
#
MAILTO=flightdeck-developers@mozilla.org

#once per day
30 1 * * * {{ crons.django }} gc

#every hour
30 * * * * {{ crons.django }} celery

MAILTO=root
