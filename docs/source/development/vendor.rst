.. _vendor:

======
Vendor
======

Vendor is a submodule. It contains all 3rd party libraries needed to run
the FlightDeck on the server (i.e. Django).

One can change it's content. To do so please clone it's repository
located at https://github.com/mozilla/FlightDeck-lib into a separate
project.

There is a nice tool called `vending machine 
<https://github.com/jbalogh/vending-machine#readme>`_ which helps with
management::

 pip install -e git://github.com/jbalogh/vending-machine#egg=vend

From the help::

 usage: vend [-h] [-d DIR] {add,update,uninstall,sync,freeze} ...

 positional arguments:
   {add,update,uninstall,sync,freeze}
     sync                sync requirements file with vendor
     freeze              freeze requirements for the vendor repo
     update              update a package or submodule
     uninstall           uninstall a package or submodule
     add                 add a package or submodule

 optional arguments:
   -h, --help            show this help message and exit
   -d DIR, --dir DIR     path to the vendor directory

However, because ``vendor`` is a submodule, vending-machine should not
be used in it's default behavior. Instead, FlightDeck-lib should be
checked out from `it's repository https://github.com/mozilla/FlightDeck-lib`_ 
to a separate folder, and you should set the ``-d`` argument of vend::

 vend -d ./FlightDeck-lib add elasticutils
