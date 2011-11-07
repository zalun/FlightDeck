.. _repackage-index:

.. XPI Gate documentation master file, created by
   sphinx-quickstart on Sun Apr 10 13:00:18 2011.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Repackage
=========

Repackage is a server service which is converting provided Add-on into a 
``xpi`` using chosen Add-on SDK.

There are currently two types of this feature depending on the way
Add-on is given. 

Builder Add-on Repackage
########################

Feature available for Add-ons created and saved in the Builder. Addons
are identified by :class:`~jetpack.models.PackageRevision`'s id in the
database

.. toctree::
   :maxdepth: 2

   api_builder.rst

XPI Repackage
#############

Decompile Add-on provided by ``xpi`` file and rebuild using chosen SDK.
This feature is available for all add-ons build with Jetpack SDK.

.. toctree::
   :maxdepth: 2

   api.rst
   strategy.rst
   structure.rst


---------------------------------------------------------------------

.. toctree::
   :maxdepth: 2

   implementation.rst

