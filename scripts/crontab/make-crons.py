#!/usr/bin/env python
import os
from string import Template

CRONS = {}

COMMON = {
    'MANAGE': '/data/amo_python/src/builder.preview/flightdeck manage.py',
    'F_CRON': '$DJANGO cron',
}

CRONS['prod'] = {
    'FLIGHTDECK': '/data/amo_python/src/builder/flightdeck',
    'DJANGO': 'apache cd $FLIGHTDECK; $MANAGE',
}

# Update each dict with the values from common.
for key, dict_ in CRONS.items():
    dict_.update(COMMON)

# Do any interpolation inside the keys.
for dict_ in CRONS.values():
    while 1:
        changed = False
        for key, val in dict_.items():
            new = Template(val).substitute(dict_)
            if new != val:
                changed = True
                dict_[key] = new
        if not changed:
            break


cron = """\
#
# !!AUTO-GENERATED!!  Edit scripts/crontab/make-crons.py instead.
#

#once per day
30 1 * * * $F_CRON clean_tmp
"""


def main():
    for key, vals in CRONS.items():
        path = os.path.join(os.path.dirname(__file__), key)
        open(path, 'w').write(Template(cron).substitute(vals))


if __name__ == '__main__':
    main()
