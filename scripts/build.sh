# This script should be called from within Hudson

cd $WORKSPACE
VENV=$WORKSPACE/venv

echo "Starting build on executor $EXECUTOR_NUMBER..." `date`

if [ -z $1 ]; then
    echo "Warning: You should provide a unique name for this job to prevent database collisions."
    echo "Usage: ./build.sh <name>"
    echo "Continuing, but don't say you weren't warned."
fi

echo "Setup..." `date`

# Make sure there are no old pyc files around.
find . -name '*.pyc' | xargs rm

if [ ! -d "$VENV/bin" ]; then
    echo "No virtualenv found.  Making one..."
    virtualenv $VENV
fi

source $VENV/bin/activate

pip install -q -r requirements/compiled.txt

# adding eventual SDK
git submodule update --init

pushd vendor && git pull && git submodule update --init && popd

# Create paths we want for addons
if [ ! -d "/tmp/flightdeck" ]; then
    mkdir /tmp/flightdeck
fi

if [ ! -d "/tmp/xpi" ]; then
    mkdir /tmp/xpi
fi

cat > settings_local.py <<SETTINGS
from settings import *
ROOT_PACKAGE = os.path.basename(ROOT)
ROOT_URLCONF = '%s.urls' % ROOT_PACKAGE
DATABASES['default']['NAME'] = 'builder_pamo'
DATABASES['default']['HOST'] = 'sm-hudson01'
DATABASES['default']['USER'] = 'hudson'
DATABASES['default']['TEST_NAME'] = 'test_builder_pamo'
DATABASES['default']['TEST_CHARSET'] = 'utf8'
DATABASES['default']['TEST_COLLATION'] = 'utf8_general_ci'
CACHE_BACKEND = 'dummy://'

UPLOAD_DIR = '/tmp/flightdeck'

SETTINGS

./manage.py syncdb

echo "Starting tests..." `date`
export FORCE_DB='yes sir'

# with-coverage excludes sphinx so it doesn't conflict with real builds.
if [[ $2 = 'with-coverage' ]]; then
    coverage run manage.py test --noinput --logging-clear-handlers --with-xunit -a'!sphinx'
    coverage xml $(find apps lib -name '*.py')
else
    python manage.py test --noinput --logging-clear-handlers --with-xunit
fi

echo 'voila!'
