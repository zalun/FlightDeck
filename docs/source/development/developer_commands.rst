

Typical git commands used by developer
======================================

Developer has a set of commands which are common for that workflow.
Please take these advices as a starting point. They do not cover whole
git functionality.

Syncing master branch
---------------------

Master branch has to be usually in sync with the main master branch::

    git checkout master
    git pull main master

Fixing a bug
------------

Checkout the branch which needs to be fixed. If it's ``master`` (most
common case), first sync as above. 

Create a branch with a bug number::

    git checkout -b bug-12345-bug_description

.. note::
    ``-b`` tells git to create a new branch. You may switch back to
    ``master`` or other already created branch by::

        git checkout branch_name`

.. note::
    If the bug is a hotfix it will be called hotfix-12345-branch_description

Make some changes, publish the bug to the ``origin`` repository::

    git commit [ list_of_files | -a ] -v
    git push origin bug-12345-bug_description

.. note::
    ``-v`` switch is to tell git to use ''verbose'' mode which opens an
    editor and displays a diff.

Send a pull request to the `Repository Manager <repository-manager>`.

After the bug has been succesfully resolved the branch may be
removed::

    git branch -d bug-12345-bug_description


Working with a fellow developer
-------------------------------

Sometimes on one bug there will be working more people. It is advised to
use the same branch name.

First create am alias for the remote repository::

    git remote add -t bug_12345-bug_description fellow http://github.com/{fellow_username}/FlightDeck.git 

Create a branch which will merge from the remote repository::

    git checkout -b bug_12345-bug_description fellow/bug-12345-bug_description

Sending the changes to ``origin`` works as before::

    git commit [ list_of_files | -a ] -v
    git push origin bug-12345-bug_description

If you'd like later to load changes done by "fellow" - pull them from
the remote branch::

    git pull fellow/bug-12345-bug_description

.. note:: 
    Remember to checkout the ``bug-12345-bug_description`` before

