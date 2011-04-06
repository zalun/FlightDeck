import time

import base.tasks

import cronjobs

@cronjobs.register
def celery():
    base.tasks.response_time.delay('celery', time.clock())
