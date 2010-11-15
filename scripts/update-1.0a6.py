# script to update from 1.0a5 to 1.0a6

import os
import sys
import site

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__,'..')))
path = lambda *a: os.path.join(ROOT, *a)

site.addsitedir('../')

site.addsitedir(path('vendor'))
site.addsitedir(path('vendor/lib/python'))

from django.core.management import execute_manager, setup_environ
import MySQLdb

import settings_local as settings
setup_environ(settings)

# database change
conn = MySQLdb.connect (
        host=settings.DATABASES['default']['HOST'] if settings.DATABASES['default']['HOST'] else 'localhost',
        user=settings.DATABASES['default']['USER'],
        passwd=settings.DATABASES['default']['PASSWORD'],
        db=settings.DATABASES['default']['NAME'],
        )
cursor = conn.cursor()

SQL = """ALTER TABLE jetpack_sdk
            ADD kit_lib_id INT DEFAULT NULL"""
            #ADD kit_name VARCHAR(100) DEFAULT 'addon-kit',
            #ADD kit_fullname VARCHAR(100) DEFAULT 'Addon Kit',
            #ADD core_name VARCHAR(100) DEFAULT 'jetpack-core',
            #ADD core_fullname VARCHAR(100) DEFAULT 'Jetpack Core'"""
try:
    cursor.execute(SQL)
except MySQLdb.OperationalError, err:
    print "Error: %s" % str(err)
    print "Is the database already updated?"

cursor.close()
conn.close()
