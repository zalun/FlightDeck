.. _amo-usecases:

=========
Use Cases
=========

Upload to AMO
#############

* Add-on author clicks on the ``UploadToAMO`` link.

* Builder validates if all fields are correct (especially if that Add-on with
  the same version_name was already successfully uploaded to AMO).
  
* Builder is scheduling a task which creates ``XPI``, changes the status
  to ``STATUS_UPLOAD_SCHEDULED`` and uploads it to AMO

* User receives a notification ``Upload to AMO is scheduled`` with a
  link to AMO Dashboard

* After the upload has been done:
  
  * User receives a notification from AMO 
  * Status is changed to default AMOStatus (``STATUS_UNREVIEWED``)
