.. _install:

Installation
============


Requirements
------------
FligtDeck depends on:
 * Python 2.6
 * MySQL
 * git

We also suggest:
 * virtualenv
 * `virtualenvwrapper <http://www.doughellmann.com/docs/virtualenvwrapper/>`_


Installing
----------

It's outside the scope of this document, but we suggest you do all your work
from within a virtualenv so your python packages don't conflict with others on
the system.  Now's the time to get in your virtualenv!

If you're going to be contributing, please fork http://github.com/mozilla/FlightDeck
before continuing so you can push code to your own branches.  Then, download the
code, substituting your name::

    git clone git@github.com:{your-username}/FlightDeck.git  # if you're not a developer, just use "mozilla" for your-username
    cd FlightDeck

Install submodules::

    git submodule update --init --recursive

Install any compiled libraries::

    pip install -r requirements/compiled.txt

Configure the site by creating a settings_local.py in your root.  Anything you
put in here will override the defaults in settings.py.  An example follows, note
the first line is required::

    from settings import *

    DEBUG = True
    TEMPLATE_DEBUG = DEBUG

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'flightdeck',
            'USER': 'root',
            'PASSWORD': '',
            'HOST': '',
            'OPTIONS': {
                'init_command': 'SET storage_engine=InnoDB'
            },
            'TEST_CHARSET': 'utf8',
            'TEST_COLLATION': 'utf8_general_ci',

        }
    }

    UPLOAD_DIR = "/tmp/flightdeck"

    SESSION_COOKIE_SECURE = False

    ES_DISABLED = True # enable when ES daemon is running
    ES_HOSTS = ['127.0.0.1:9201']
    ES_INDEX = 'flightdeck'

    CACHES['default']['BACKEND'] =
    'django.core.cache.backends.locmem.LocMemCache'

Make sure that MySQL is running, then create the database you specified
in settings_local.py::

    mysql -u root -p

    [MySQL messages snipped]

    mysql> CREATE DATABASE flightdeck;
    Query OK, 1 row affected (0.00 sec)

If this is a brand new installation you'll need to configure a database as
well.  This command will build the structure::

    ./manage.py syncdb
    
If you're using Elastic Search locally (this is not necessary for basic functionality)
then be sure to setup the ES index mappings and index all your packages::

    ./manage.py cron setup_mapping
    ./manage.py cron index_all

FlightDeck needs to know about the SDKs you have available (in ./lib).  This command
will make a single version of the SDK available in FlightDeck's Libraries selector::

    ./manage.py add_core_lib addon-sdk-1.2.1

If you're writing code and would like to add some test data to the database
you can load some fixtures::

    ./manage.py loaddata users packages

Run the development server::

    ./manage.py runserver

In Firefox's about:config create a new string preference named 
extensions.addonBuilderHelper.trustedOrigins with the value
``https://builder.addons.mozilla.org/,http://127.0.0.1:8000/``;
install the Add-on Builder Helper (if you had it already installed, 
restart the browser after changing the preference)

Navigate the browser to http://127.0.0.1:8000/, log in with the username
and password you entered while running ``./manage.py syncdb``.

You're all done!

Recipes
=======


Create a local super user account
---------------------------------

If you imported your database then you will need to create a user::

    ./manage.py createsuperuser
    
    
Building documentation
----------------------

FlightDeck uses `Sphinx <http://sphinx.pocoo.org/contents.html>`_-based 
documentation, so you have to install sphinx in order to build the docs::

    pip install sphinx
    make -C docs html

.. note::
    If you get ``ValueError: unknown locale: UTF-8``, run 
    ``export LC_ALL=en_US.UTF-8`` before ``make``.


Import live database dump
-------------------------

How to import a database dump from live::

    [sudo] mysql flightdeck < flightdeck_dump.sql
    
If you run into an error when importing large sql dump files, you may need to
restart your mysqld process with this parameter::

    mysqld --max_allowed_packet=32M
    
The database dump might be missing a row in django_sites table, so if you get a
django error saying "Site matching query does not exist" when you hit the login
page then insert a row into django_site::

    insert into django_site (id,domain,name) values (1,'example.com','example')
    
After importing the data, you will need to rebuild your ES index.


Elastic Search
--------------

`ElasticSearch <http://elasticsearch.org/>`_  is a Lucene based search engine
that powers FlightDeck search. We also use 
`pyes <https://github.com/aparo/pyes>`_ a pythonic interface to ElasticSearch.

**Running**

You will need to point it at a config file that we've
included in ``scripts/es.yml``::

    elasticsearch -f -Des.config=./scripts/es.yml

This configuraion can be overridden if necessary.  More details are 
`here <http://www.elasticsearch.org/guide/reference/setup/configuration.html>`_.


**Development**

``settings.py`` needs to be overridden in order to use ElasticSearch.  Both
``ES_DISABLED`` needs to be ``False`` and ``ES_HOSTS`` needs to be set.  This
can be done in ``settings_local.py``.

**Testing**

In order for testing to work ``ES_HOSTS`` needs to be defined (otherwise
SkipTest will be raised) and ElasticSearch needs to be running.  We
specifically look at a single index, ``test_flightdeck``, in order to avoid
conflicts with development data.

**Rebuilding Elastic Search index**

Need to delete your Elastic Search index and start over?::

    curl -XDELETE 'http://localhost:9201/flightdeck'
    ./manage.py cron setup_mapping
    ./manage.py cron index_all
    
    
Using with Celery
-----------------

Majority of resources heavy tasks is done by delegating them to celery.

By default on development boxes celery is not running and tasks are run 
synchronously. To be able to test celery tasks one has to configure the 
development system to resemble the production one.

Celery requires a running messaging system. We use 
`RabbitMQ <http://www.rabbitmq.com/>`_.

To configure please copy the Celery section from ``settings.py`` to 
``settings_local.py`` and uncomment it.

.. code-block:: python

   # These settings are for if you have celeryd running
   BROKER_HOST = 'localhost'
   BROKER_PORT = 5672
   BROKER_USER = 'builder'
   BROKER_PASSWORD = 'builder'
   BROKER_VHOST = 'builder'
   BROKER_CONNECTION_TIMEOUT = 0.1
   CELERY_RESULT_BACKEND = 'amqp'
   CELERY_IGNORE_RESULT = True

**RabbitMQ CheatSheet**

Create user, virtual host and give user all privileges::

    sudo rabbitmqctl add_user builder builder
    sudo rabbitmqctl add_vhost builder
    sudo rabbitmqctl set_permission -p builder builder ".*" ".*" ".*"


From project directory run::

    ./manage.py celeryd -l INFO


Using Apache
------------

Production environments will expect to be running through another webserver.
An example :download:`apache.conf
</_static/apache.conf>`

An example Apache WSGI configuration :download:`apache.wsgi 
</_static/apache.wsgi>`

