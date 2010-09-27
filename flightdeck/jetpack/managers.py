from django.db import models

class PackageManager(models.Manager):

	def active(self):
		return self.filter(active=True)

	def disabled(self):
		return self.filter(active=False)

	def addons(self):
		return self.active().filter(type="a")

	def libraries(self, active_only=True):
		return self.active().filter(type="l")


#TODO: Add Library and Addon managers and use them inside Package and views

class PackageRevisionManager(models.Manager):

	def filter_by_slug(self, slug):
		 return self.select_related().filter(package__slug=slug)

