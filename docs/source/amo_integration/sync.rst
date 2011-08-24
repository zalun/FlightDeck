.. _amo-syncing_packages:

================
Syncing Packages
================


Identification
##############

:class:`~jetpack.models.Package` has a field ``amo_id`` which used to
store id of the related Package on the AMO. During the synchronization
process program_id is updated, so all generated ``XPI`` are properly 
identified by AMO.

For validation purposes :class:`~jetpack.models.PackageRevision` has the 
fields ``amo_status`` and ``amo_version_name``.

Scenarios:
##########

All of these scenarios are run by the author of the add-on and on the 
:ref:`edit_package-page`.


Create new add-on
-----------------

Package created in the Builder can be exported to AMO. This action
involves creating a new Addon on the AMO, uploading all necessary meta
data and a ``XPI`` build on the Builder.

.. _amo-syncing_packages-update:

Update an existing add-on
-------------------------

If a Package is already synchronized, new version might be uploaded to AMO.
This requires version name to be changed.


Synchronizing an add-on existing on AMO
---------------------------------------

.. warning:: This features is under development

It might happen, that a user will move add-on development to the Builder. To
upload a new version of the add-on one needs to link an AMO add-on with the
Builder one.

User has an ability to display a list of his add-ons on AMO and choose
which one should be linked to the currently displayed add-on.

Attributes :attr:`jetpack.models.Package.amo_id` and
:attr:`jetpack.models.Package.jid` are saved in the separate view. If this 
was called as a part of uploading an add-on scenario, after the response is 
received :ref:`amo-syncing_packages-update` is called.

