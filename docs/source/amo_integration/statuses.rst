.. _amo-statuses:

===============
Add-on statuses
===============

Every Add-on uploaded to AMO has a status which is one of the following:

* ``STATUS_NULL`` - Incomplete
* ``STATUS_UNREVIEWED`` - (**default**) - Awaiting Preliminary Review
* ``STATUS_PENDING`` - Pending approval
* ``STATUS_NOMINATED`` - Awaiting Full Review
* ``STATUS_PUBLIC`` - Fully Reviewed
* ``STATUS_DISABLED`` - Disabled by Mozilla
* ``STATUS_LISTED`` - Listed
* ``STATUS_BETA`` - Beta
* ``STATUS_LITE`` - Preliminarily Reviewed
* ``STATUS_LITE_AND_NOMINATED`` - Preliminarily Reviewed and Awaiting Full Review
* ``STATUS_PURGATORY`` - Pending a review choice

The AMOStatus needs to be stored (and updated) within
:class:`~jetpack.models.PackageRevision`.

Builder adds another statuses:

* ``STATUS_UPLOAD_SCHEDULED`` - Upload scheduled
* ``STATUS_UPLOAD_FAILED`` - Upload failed

If upload finished with success the default AMOStatus will be used. 
