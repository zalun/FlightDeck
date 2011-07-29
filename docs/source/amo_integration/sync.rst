.. _amo-syncing_packages:

================
Syncing Packages
================

.. warning:: This features are under development


Identification
##############

:class:`~jetpack.models.Package` has a field ``amo_id`` which used to
store id of the related Package on the AMO. During the synchronization
process program_id is updated, so all generated ``XPI`` are properly 
identified by AMO.


Synchronizing an Addon existing on AMO
######################################

User has an ability to display a list of his Addons on AMO and choose
which one relies to the currently displayed Package.


Create new Package
##################

Package created in the Builder can be exported to AMO. This action
involves creating a new Addon on the AMO, uploading all necessary meta
data and a ``XPI`` build on the Builder.


Update an existing Package
##########################

If a Package is already synchronized, new version might be uploaded to AMO.
This requires version name to be changed.
