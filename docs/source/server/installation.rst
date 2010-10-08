Installation on the server
==========================

FligtDeck depends on Python, virtualenv, virtualenvwrapper, mysql, git, 
mercurial, xulrunner.

#. Download the code::

    git clone git://github.com/mozilla/FlightDeck.git -b production
    # or -b staging if staging server

#. Create the upload directory::

    cd FlightDeck
    mkdir upload
    # make it writable by HTTP server

#. Create local configuration file and modify it to suit your needs::

    cp flightdeck/settings_local-default.py flightdeck/settings_local.py
    # vi flightdeck/settings_local.py

#. Create virtual environment::

    mkvirtualenv flighdeck
    pip install requirements/production.txt
    echo "export DJANGO_SETTINGS_MODULE=flightdeck.settings" >> $VIRTUAL_ENV/bin/postactivate
    echo "export CUDDLEFISH_ROOT=$VIRTUAL_ENV" >> $VIRTUAL_ENV/bin/postactivate

#. Add first Add-on SDK::

    mkdir sdk_versions
    hg clone -r 0.8 http://hg.mozilla.org/labs/jetpack-sdk/ jetpack-sdk
    # the version might be changed according to the needs

#. Initiate database::

    cd flightdeck
    python manage.py syncdb

#. Load Add-on SDK into the database::

    python manage.py create_core_lib 

#. Configure Apache, a sample config is in 
   ``apache/config_local-default.wsgi``. Please copy to 
   ``apache/config_local.wsgi`` before modifying.
