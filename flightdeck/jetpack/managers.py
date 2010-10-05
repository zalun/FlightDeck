"""
Managers for the Jetpack models
"""


from django.db import models


class PackageManager(models.Manager):
    " manager for Package object "

    def active(self):
        " filter out inactive packages "
        return self.filter(active=True)

    def disabled(self):
        " filter out active packages "
        return self.filter(active=False)

    def addons(self):
        " return addons only "
        return self.active().filter(type="a")

    def libraries(self):
        " return libraries only "
        return self.active().filter(type="l")


#TODO: Add Library and Addon managers and use them inside Package and views


class PackageRevisionManager(models.Manager):
    " manager for Package Revision objects "

    def filter_by_slug(self, slug):
        " get revision by package's slug "
        return self.select_related().filter(package__slug=slug)
