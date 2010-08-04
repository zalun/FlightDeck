from django.db import models

class PackageManager(models.Manager):

	def existing(self):
		return self.filter(deleted=False)

	def active(self):
		return self.existing().filter(active=True)

	def addons(self, active_only=True):
		collection = self.active() if active_only else self.existing()
		return collection.filter(type="a")

	def libraries(self, active_only=True):
		collection = self.active() if active_only else self.existing()
		return collection.filter(type="l")



class PackageRevisionManager(models.Manager):

	def filter_by_slug(self, slug):
		 return self.select_related().filter(package__slug=slug)

