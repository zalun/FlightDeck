Installation on the server
==========================

FligtDeck depends on Python, virtualenv, virtualenvwrapper, mysql, git, 
mercurial, xulrunner.

#. Download the code::

    git clone git://github.com/mozilla/FlightDeck.git
    cd FlightDeck
    git branch production 
    # or staging if staging server

#. Create the upload directory::

    mkdir upload
    # make it writable by HTTP server

#. Create local configuration file and modify it to suit your needs::

    cd flightdeck
    cp settings_local-default.py settings_local.py

#. Create virtual environment::

    mkvirtualenv flighdeck
    cd FlightDeck
    pip install requirements/production.txt
    echo "export DJANGO_SETTINGS_MODULE=flightdeck.settings" >> $VIRTUAL_ENV/bin/postactivate
    echo "export CUDDLEFISH_ROOT=$VIRTUAL_ENV" >> $VIRTUAL_ENV/bin/postactivate

#. Initiate database::

    cd flightdeck
    python manage.py syncdb

#. Configure Apache, a sample config is in 
   ``apache/config_local-default.wsgi``. Please copy to 
   ``apache/config_local.wsgi`` before modifying.
