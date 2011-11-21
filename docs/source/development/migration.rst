.. _database_migration::

==================
Database Migration
==================

Add-ons Builder uses `Schematic <github.com/jbalogh/schematic.git>`_.
*"The worst schema versioning system, ever?"*.

Usage
#####

Applying migrations
-------------------

.. code-block:: bash

   ./vendor/src/schematic/schematic ./migrations/


Creating migrations
-------------------

Create ``migrations/{number}-{some_name}.[py/sql]`` file (check 
``migrations`` directory for examples). Python files will be executed and 
SQL run directly on database. 


Troubleshooting
---------------

Schematic is storing current migration number in ``schema_version``
table. Change it if you've created database by ``./manage.py syncdb``.
