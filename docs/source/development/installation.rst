.. _dev-install:

Installation for development
============================

FligtDeck depends on Python, virtualenv, virtualenvwrapper, mysql, git, 
mercurial, xulrunner.

* Please fork the http://github.com/mozilla/FlightDeck before

* Download the code::

    git clone git@github.com:{your-username}/FlightDeck.git

* Add Mozilla's repository as the ''main one''::

    git remote add main git://github.com/mozilla/FlightDeck.git

.. include:: ../_includes/installation_create_dirs.rst

.. include:: ../_includes/installation_local_config.rst

* Set to development mode::

    echo "PRODUCTION = False" >> flightdeck/settings_local.py

.. include:: ../_includes/installation_virtual_env.rst

.. include:: ../_includes/installation_sdk.rst

.. include:: ../_includes/installation_database.rst

* **OPTIONAL** You may find it useful to load some fixtures::

    # python manage.py loaddata users packages
