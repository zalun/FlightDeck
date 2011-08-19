# Logging (copied from zamboni)
import logging
import logging.handlers

from django.conf import settings

import commonware.log
# Currently Django does not provide dictconfig
# from django.utils.log import dictConfig
from utils.dictconfig import dictConfig


class NullHandler(logging.Handler):

    def emit(self, record):
        pass


base_fmt = ('%(name)s:%(levelname)s %(message)s '
            ':%(pathname)s:%(lineno)s')

cfg = {
    'version': 1,
    'filters': {},
    'formatters': {
        'debug': {
            '()': commonware.log.Formatter,
            'datefmt': '%H:%M:%s',
            'format': '%(asctime)s ' + base_fmt,
        },
        'prod': {
            '()': commonware.log.Formatter,
            'datefmt': '%H:%M:%s',
            'format': '%s: [%%(USERNAME)s][%%(REMOTE_ADDR)s] %s' % (settings.SYSLOG_TAG,
                                                     base_fmt),
        },
    },
    'handlers': {
        'console': {
            '()': logging.StreamHandler,
            'formatter': 'debug',
        },
        'syslog': {
            '()': logging.handlers.SysLogHandler,
            'facility': logging.handlers.SysLogHandler.LOG_LOCAL7,
            'formatter': 'prod',
        },
        'null': {
            '()': NullHandler,
        },
        'mail_admins': {
            'level': 'ERROR',
            'class': 'utils.admin_log.AdminEmailHandler'
        }
    },
    'loggers': {
        'f': {},
        'django.request': {
            'handlers': ['mail_admins'],
            'level': 'ERROR',
            'propagate': False,
        }
    },
    'root': {},
}

for key, value in settings.LOGGING.items():
    cfg[key].update(value)

# Set the level and handlers for all loggers.
for logger in cfg['loggers'].values() + [cfg['root']]:
    syslog = settings.HAS_SYSLOG and not settings.DEBUG
    if 'handlers' not in logger:
        logger['handlers'] = ['syslog' if syslog else 'console']
    if 'level' not in logger:
        logger['level'] = settings.LOG_LEVEL
    if logger is not cfg['root'] and 'propagate' not in logger:
        logger['propagate'] = False

dictConfig(cfg)
