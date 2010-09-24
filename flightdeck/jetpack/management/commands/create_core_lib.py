from django.core.management.base import BaseCommand, CommandError
from jetpack.management import create_jetpack_core

class Command(BaseCommand):
	def handle(self, *args, **kwargs):
		try:
			create_jetpack_core()
			print "Jetpack Core Library created successfully"
		except Exception, e:
			print "Error: %s" % e


