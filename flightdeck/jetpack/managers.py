from django.db import models

class PackageManager(models.Manager):

	def active(self):
		return self.filter(active=True)

	def addons(self):
		return self.active().filter(type="a")

	def libraries(self, active_only=True):
		return self.active().filter(type="l")



class PackageRevisionManager(models.Manager):

	def filter_by_slug(self, slug):
		 return self.select_related().filter(package__slug=slug)

