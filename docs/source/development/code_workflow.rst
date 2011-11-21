.. _code-workflow:

=============
Code Workflow
=============

We use a simplified `Vincent Driessen's model
<http://nvie.com/git-model>`_

Decentralized, but Centralized
==============================
Every developer has his own repository (we called ``origin`` in this and 
following documents). There is only one referencing *upstream* repository. 
``upstream/master`` branch is deployed to
http://builder-addons-dev.allizom.org/ by Github's PUSH request.
Production server is updated from tags (i.e. ``0.9.12``) by IT team.

bug-*
-----
Must branch of from ``master`` or other ``bug-*``.
Naming convention: ``bug-{bugzilla_bug_id}-short_description``

Fixes one bug. It will be merged to the ``upstream.master``

production
----------

If there is a serious bug in production we branch off tag to 
``upstream/production`` branch, fix it and tag it again.

hotfix-*
--------
Must branch off from ``upstream/production``
Merges back to ``upstream/production`` and eventually
``upstream/master``

This branch is for fixes to freezed code - in production

