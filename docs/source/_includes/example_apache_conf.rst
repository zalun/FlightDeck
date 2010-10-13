* An example Apache .conf::

    <VirtualHost *:80>
        ServerAdmin your@mail.com
        ServerName flightdeck.some.domain

        <Directory /path/to/FlightDeck/apache/>
            Order deny,allow
            Allow from all
            Options Indexes FollowSymLinks
        </Directory>

        <Location "/adminmedia">
            SetHandler default
        </Location>
        Alias /adminmedia /path/to/FlightDeck/flightdeck/adminmedia

        <Location "/media/tutorial">
            SetHandler default
        </Location>
        Alias /media/tutorial /path/to/FlightDeck/flightdeck/tutorial/media

        <Location "/media/api">
            SetHandler default
        </Location>
        Alias /media/api /path/to/FlightDeck/flightdeck/api/media

        <Location "/media/jetpack">
            SetHandler default
        </Location>
        Alias /media/jetpack /path/to/FlightDeck/flightdeck/jetpack/media

        <Location "/media">
            SetHandler default
        </Location>
        Alias /media /path/to/FlightDeck/flightdeck/media

        LogLevel warn
        ErrorLog  /path/to/FlightDeck/logs/apache_error.log
        CustomLog /path/to/FlightDeck/logs/apache_access.log combined

        WSGIDaemonProcess flightdeck user=www-data group=www-data threads=25
        WSGIProcessGroup flightdeck

        WSGIScriptAlias / /path/to/FlightDeck/apache/config_local.wsgi
    </VirtualHost>
