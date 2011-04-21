.. _repackage-structure_plane:

=========
Structure
=========

.. note:: The **structure** defines the way in which the various features and functions of the site fit together. It defines the path user has to go to reach any page of the site from the other page


Repackage is a **View** in the ``XPI`` **Application**.

It receives the id in AMO and ``XPI`` filename via GET.

It will call the same xpi creation celery task as standard Builder.
