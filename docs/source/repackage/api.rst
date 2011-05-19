.. _repackage-api:

===
API
===

Rebuild an addon from FTP
#########################

Rebuild a package hosted on ``ftp://ftp.mozilla.org/pub/mozilla.org/addons/``

**URL:** ``/repackage/rebuild/``

**method:** POST

Fields:
-------

**amo_id**
   Integer number specifying the directory

**amo_file**
   Base filename of the ``XPI`` file (without extension)

**target_version** (optional)
   Force version for the rebuild package

Returns
-------

Service immediately returns JSON object with a ``hashtag`` field. 
This hashtag is the used to check if the rebuild process has been
finished and later to download new ``XPI`` file.

**check URL**
   ``/xpi/check_download/{hashtag}/``

   Returns JSON with a field ``ready`` which is either ``true`` or
   ``false``

**download URL**
   ``/xpi/download/{hashtag}/``

   Returns a ``XPI`` file.
