.. _repackage-api:

===
API
===

Rebuild an addon from FTP
#########################

**URL:** ``/repackage/rebuild/``

**method:** POST

Fields:
-------

One of the ``location`` or ``addons`` fields must be present

**priority**
   force the priority of the task 

**secret**
   password proving the request came from a trusted source

**location**
   URL for the ``XPI`` file to download

**addons**
   JSON string - a table of dicts containing addons data.
   ``[{"location": "ftp://{...}", "version": "force.version" }]``.
   It can use all of the ``package.json`` fields provided below,
   ``filename``. It has to contain ``location`` in every dict.

**pingback**
   URL to pass the result

**filename**
   desired filename for the downloaded ``XPI``

**version, type, fullName, url, description, author, license, lib, data,
tests, main** (optional)
   Force ``package.json`` fields.

Examples of data definition in Python:

.. code-block:: python

   # single addon rebuild
   post = {'addon': file_.version.addon_id,
           'file_id': file_.id,
           'priority': priority,
           'secret': settings.BUILDER_SECRET_KEY,
           'location': file_.get_url_path(None, 'builder'), 
           'uuid': data['uuid'],
           'pingback': reverse('files.builder-pingback'),
           'version': 'force_version'}

.. code-block:: python

   # bulk rebuild
   addons = [{'location': f.get_url_path(None, 'builder'),
              'addon': f.version.addon_id,
              'file_id': f.id,
              'version': '%s.rebuild' % f.version} for f in addon_files]

   post = {'priority': priority,
           'secret': settings.BUILDER_SECRET_KEY,
           'uuid': data['uuid'],
           'pingback': reverse('files.builder-pingback'),
           'addons': simplejson.dumps(addons)}


Returns
-------
After the ``XPI`` has been created Builder will send the response to the 
pingback URL. Whole request will also be send back.

**result**
   "success" or "failure"

**msg**
   ``stdout`` if result is ``success`` else ``stderr`` returned by ``cfx xpi``

**location**
   URL to download the rebuild ``XPI`` from

**secret**
   password proving the request came from a trusted source

**request**
   urlified request.POST used for initial request


API send and return
###################

Send
----



Response
--------

Send to the pingback

.. code-block:: python

   data = {
       'id': rep.manifest['id'],
       'secret': settings.BUILDER_SECRET_KEY,
       'result': 'success' if not response[1] else 'failure',
       'msg': response[1] if response[1] else response[0],
       'location': reverse('jp_download_xpi', args=[hashtag, filename]),
       'request': post}
