.. _repackage-structure_plane:

=========
Structure
=========

.. note:: The **structure** defines the way in which the various features and functions of the site fit together. It defines the path user has to go to reach any page of the site from the other page


Repackage is an **Application**.

It contains several views and celery tasks needed to complete the goal.

Repackage XPI build is different from Add-ons Builder XPI build only in
the way it's preparing the packages. Instead of reading them from
database/request it's unpacking received XPI.
