Installation on the server
==========================

FligtDeck depends on Python, virtualenv, mysql, git, mercurial, xulrunner, wget.

#. Download the code::

    git clone git://github.com/mozilla/FlightDeck.git

#. Initiate local files::

    ./scripts/initiate.sh

#. Modify configuration in ``flightdeck/settings_local.py`` and ``scripts/config_local.sh``

#. Install production environment::

    ./scripts/install.sh

#. Initiate database::

    ./scripts/manage.sh syncdb



