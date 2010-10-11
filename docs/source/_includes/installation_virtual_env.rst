* Create virtual environment::

    mkvirtualenv flighdeck
    pip install -r requirements/production.txt
    echo "export DJANGO_SETTINGS_MODULE=flightdeck.settings" >> $VIRTUAL_ENV/bin/postactivate
    echo "export CUDDLEFISH_ROOT=$VIRTUAL_ENV" >> $VIRTUAL_ENV/bin/postactivate
    echo export PYTHONPATH=$PYTHONPATH:`pwd`:`pwd`/flightdeck >> $VIRTUAL_ENV/bin/postactivate
    deactivate
    workon flightdeck
