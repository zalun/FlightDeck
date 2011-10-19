#!/usr/bin/env python
import os
from optparse import OptionParser

from jinja2 import Template


TEMPLATE = open(os.path.join(os.path.dirname(__file__), 'crontab.tpl')).read()


def main():
    parser = OptionParser()
    parser.add_option("-w", "--webapp",
                      help="Location of webapp (required)")
    parser.add_option("-u", "--user",
                      help=("Prefix cron with this user. "
                           "Only define for cron.d style crontabs"))
    parser.add_option("-p", "--python", default="/usr/bin/python2.6",
                      help="Python interpreter to use")

    (opts, args) = parser.parse_args()

    if not opts.webapp:
        parser.error("-w must be defined")

    django = 'cd %s; %s manage.py' % (opts.webapp, opts.python)
    ctx = {}
    ctx['python'] = opts.python
    ctx['crons'] = {
        'django': '%s cron' % django,
    }

    if opts.user:
        for k, v in ctx['crons'].iteritems():
            ctx['crons'][k] = '%s %s' % (opts.user, v)

    print Template(TEMPLATE).render(**ctx)


if __name__ == "__main__":
    main()
