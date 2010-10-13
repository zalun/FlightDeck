* An example Apache WSGI configuration::

    import sys
    import os
    import site

    VIRTUAL_ENV = '/path/to/virtual/environment'
    PROJECT_PATH = '/path/to/projects/FlightDeck'

    # All directories which should on the PYTHONPATH
    ALLDIRS = [
	    os.path.join(VIRTUAL_ENV, 'lib/python2.6/site-packages'),
	    PROJECT_PATH,
	    os.path.join(PROJECT_PATH, 'flightdeck'),
    ]

    # Remember original sys.path.
    prev_sys_path = list(sys.path)

    # Add each new site-packages directory.
    for directory in ALLDIRS:
        site.addsitedir(directory)

    # add the app's directory to the PYTHONPATH
    # apache_configuration= os.path.dirname(__file__)
    # project = os.path.dirname(apache_configuration)
    # workspace = os.path.dirname(project)
    # sys.path.append(workspace)

    for s in ALLDIRS:
	    sys.path.append(s)

    # reorder sys.path so new directories from the addsitedir show up first
    new_sys_path = [p for p in sys.path if p not in prev_sys_path]
    for item in new_sys_path:
	    sys.path.remove(item)
	    sys.path[:0] = new_sys_path

    os.environ['VIRTUAL_ENV'] = VIRTUAL_ENV
    os.environ['CUDDLEFISH_ROOT'] = VIRTUAL_ENV
    os.environ['PATH'] = "%s:%s/bin" % (os.environ['PATH'], VIRTUAL_ENV)
    os.environ['DJANGO_SETTINGS_MODULE'] = 'flightdeck.settings'

    import django.core.handlers.wsgi
    application = django.core.handlers.wsgi.WSGIHandler()
