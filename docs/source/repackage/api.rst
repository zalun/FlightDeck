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

**priority**
   force the priority of the task 

**secret**
   password proving the request came from a trusted source

**location**
   URL for the ``XPI`` file to download

**pingback**
   URL to pass the result

**filename**
   desired filename for the downloaded ``XPI``

**version, type, fullName, url, description, author, license, lib, data,
tests, main** (optional)
   Force ``package.json`` fields.

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

.. code-block:: python

   post = {'addon': file_.version.addon_id,
           'file_id': file_.id,
           'priority': priority,
           'secret': settings.BUILDER_SECRET_KEY,
           'location': file_.get_url_path(None, 'builder'), 
           'uuid': data['uuid'],
           'pingback': reverse('files.builder-pingback')}

Response
--------

.. code-block:: python

   response = {'result': ...,
               'msg': ...,
               'location': ...,
               'secret': ...,
               'request': json.dumps(post)}
