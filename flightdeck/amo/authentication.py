import MySQLdb
import hashlib

from mechanize import Browser
from BeautifulSoup import BeautifulSoup

from django.contrib.auth.models import User
from django.utils.encoding import smart_str

from person.models import Profile, Limit
from amo import settings

DEFAULT_AMO_PASSWORD = 'saved in AMO'

class AMOAuthentication:

	def authenticate(self, username, password):
		"""
			Authenticate user by contacting with AMO
		"""


		# TODO: Validate alphanum + .-_@
		
		# check if username exists in database
		try:
			user = User.objects.get(username=username)
			# was user signed up via AMO?
			if user.password != DEFAULT_AMO_PASSWORD:
				" standard authorisation "		
				if user.check_password(password):
					try:
						profile = user.get_profile()
					except:
						profile = Profile(user=user)
						profile.save()
					return user
				return None
		except User.DoesNotExist:
			user = None

		if settings.AMO_LIMITED_ACCESS:
			if username not in [x.email for x in list(Limit.objects.all())]:
				return None

		# here contact AMO and receive authentication status
		email = username

		scrape = True
		if settings.AUTH_DATABASE:
			try:
				username = self.auth_db_authenticate(username, password)
				scrape = False
			except:
				# something wrong with database - let's scrape
				pass
				
		if scrape:
			username = self.scrape_authenticate(username, password)

		if not username:
			return None

		
		try:
			user = User.objects.get(username=username)
			if user.email != email:
				user.email = email
				user.save()
		except:
			# save user into the database
			user = User(
				username=username,
				email=email,
				password=DEFAULT_AMO_PASSWORD,
			)
			user.save()
		
		# Manage profile
		try:
			profile = user.get_profile()
		except Profile.DoesNotExist:
			profile = Profile(user=user)

		if not scrape:
			return self.update_profile(user, profile, self.user_data)

		if not (user.first_name or profile.nickname):
			# here contact AMO and receive profile
			return self.scrape_update_profile(user, profile)

		return user

	def get_user(self, user_id):
		try:
			return User.objects.get(pk=user_id)
		except:
			return None

	
	def auth_db_authenticate(self, username, password):
		columns = ('id','email','username','display_name','password','firstname','lastname','nickname','bio','emailhidden','sandboxshown','homepage','display_collections','display_collections_fav','confirmationcode','resetcode','resetcode_expires','notifycompat','notifyevents','deleted','created','modified','notes','location','occupation','picture_type','averagerating','user_id','last_login_ip','last_login_attempt','last_login_attempt_ip','failed_login_attempts')

		auth_conn = MySQLdb.connect(
			host=settings.AUTH_DATABASE['HOST'],
			user=settings.AUTH_DATABASE['USER'],
			passwd=settings.AUTH_DATABASE['PASSWORD'],
			db=settings.AUTH_DATABASE['NAME']
		)
		auth_cursor = auth_conn.cursor()
		SQL = 'SELECT * FROM %s WHERE email="%s"' % (settings.AUTH_DATABASE['TABLE'], username)
		auth_cursor.execute(SQL)
		data = auth_cursor.fetchone()
		user_data = {}
		for i in range(len(data)):
			user_data[columns[i]] = data[i]
		if not user_data:
			return None

		if '$' not in user_data['password']:
			valid = (get_hexdigest('md5', '', password) == user_data['password'])
		else:
			algo, salt, hsh = user_data['password'].split('$')
			valid = (hsh == get_hexdigest(algo, salt, password))

		if not valid:
			return None

		username = user_data['user_id']
		self.user_data = user_data
		return username


	def scrape_authenticate(self, username, password):
		self.br = Browser()
		self.br.open("https://addons.mozilla.org/en-US/firefox/users/login?to=en-US")
		
		self.br.select_form(nr=2)
		self.br['data[Login][email]'] = username
		self.br['data[Login][password]'] = password

		response = self.br.submit()
		response_url = response.geturl()
		valid_urls = [
					'https://addons.mozilla.org/en-US/firefox/', 
					'https://addons.mozilla.org/en-US/firefox'
		]
		if not response_url in valid_urls:
			return None
		
		link = self.br.find_link(text='View Profile')
		email = username
		# retrieve username from the View Profile link
		# https://addons.mozilla.org/en-US/firefox/user/123456/
		# AMO developers once removed the trailing slash which has broken the database
		# all FD users had the username 'user'
		# following is to prevent such failure in the future
		if link.url[-1] != '/':
			username = link.url.split('/')[-1]
		else:
			username = link.url.split('/')[-2]

		if not username or username =='user':
			raise Exception("Problems with View Profile link")

		return username


	def scrape_update_profile(self, user, profile):
		# should fire for new and invalid accounts
		# scrap initial profile data from AMO
		response = self.br.follow_link(text='Edit Profile')
		data = scrap_amo_profile(response)
		return self.update_profile(user, profile, data)
		
	def update_profile(self, user, profile, data):
		is_user_changed = False
		if 'firstname' in data:
			user.first_name = data['firstname']
			is_user_changed = True
		if 'lastname' in data:
			user.last_name = data['lastname']
			is_user_changed = True
		if is_user_changed:
			user.save()
		
		if 'nickname' in data:
			profile.nickname = data['nickname']
		if 'location' in data:
			profile.location = data['location']
		if 'occupation' in data:
			profile.occupation = data['occupation']
		if 'homepage' in data:
			profile.homepage = data['homepage']
		if 'photo' in data:
			profile.photo = data['photo']

		profile.save()

		return user
			

def get_hexdigest(algorithm, salt, raw_password):
	return hashlib.new(algorithm, smart_str(salt + raw_password)).hexdigest()

def scrap_amo_profile(response):
	soup = BeautifulSoup(response)
	data = {}
	for inp in soup.findAll('input'):
		try:
			if ('name', 'firstname') in inp.attrs:
				data['firstname'] = inp['value']
			elif ('name','lastname') in inp.attrs:
				data['lastname'] = inp['value']
			elif ('name','display_name') in inp.attrs:
				if inp['value']:
					if not (data.get('firstname', False) or data.get('lastname', False)):
						names = split(' ', inp['value'])
						data['firstname'] = names[0]
						if len(names) > 1:
							data['lastname'] = names[-1]
			elif ('name', 'username') in inp.attrs:
				data['nickname'] = inp['value']
			elif ('name', 'location') in inp.attrs:
				data['location'] = inp['value']
			elif ('name','occupation') in inp.attrs:
				data['occupation'] = inp['value']
			elif ('name', 'homepage') in inp.attrs:
				data['homepage'] = inp['value']
		except:
			pass
	for img in soup.findAll('img'):
		classes = filter(lambda x: x[0] == 'class', img.attrs)
		alts = filter(lambda x: x[0] == 'alt', img.attrs)
		srcs = filter(lambda x: x[0] == 'src', img.attrs)
		if classes and alts and srcs:
			if 'avatar' in classes[0][1] and srcs[0][1] != 'https://addons.mozilla.org/media///img/zamboni/anon_user.png':
				data['photo'] = 'https://addons.mozilla.org%s' % srcs[0][1]
	return data
