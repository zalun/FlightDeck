.. _repackage-api_builder:

=======================
API for Builder Add-ons
=======================

**URL:** ``/repackage/rebuild-addons/``

**method:** POST

Fields:
-------

**secret**
   password proving the request came from a trusted source

**sdk_version**
   version of the SDK which should be used to rebuild the package

**addons**
   JSON string - a list of dicts containing addons data.
   ``[{"paclkage_key": 1234, "version": "force.version", ... }]``.
   All of the ``package.json`` may be overwritten.

   **paclkage_key** is the unique identifier of the
   :class:`~jetpack.models.PackageRevision` in
   the Builder

   **version** (optional) is the way to force the version with which the
   xpi will be built.

**priority**
   (optional) if it is present set it to ``'high'`` - force the priority 
   of the task.

**pingback**
   (optional) URL to pass the result
