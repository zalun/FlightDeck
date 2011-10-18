import os

from commander.deploy import hostgroups, task


AMO_PYTHON_ROOT = '/data/amo_python'
FLIGHTDECK_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


@task
def deploy_code(ctx):
    with ctx.lcd(AMO_PYTHON_ROOT):
        ctx.local("/usr/bin/rsync -aq --exclude '.git*' --delete src/builder/ www/builder/")
        with ctx.lcd("www"):
            ctx.local("git add .")
            ctx.local("git commit -a -m 'flightdeck push'")

    pull_code()


@hostgroups(["amo", "amo_gearman"])
def pull_code(ctx):
    ctx.remote("/data/bin/libget/get-php5-www-git.sh")
    ctx.remote("touch /data/amo_python/www/builder/flightdeck/wsgi/flightdeck.wsgi")


@hostgroups(["amo_gearman"])
def restart_celery(ctx):
    ctx.remote("service celeryd-builder_prod restart")
    ctx.remote("service celeryd-builder_prod_bulk restart")


@task
def schematic(ctx):
    with ctx.lcd(FLIGHTDECK_DIR):
        ctx.local("python2.6 ./vendor/src/schematic/schematic migrations")


@task
def disable_cron(ctx):
    ctx.local("mv /etc/cron.d/builder-prod-maint /tmp/builder-prod-maint")


@task
def enable_cron(ctx):
    with ctx.lcd(FLIGHTDECK_DIR):
        ctx.local("cp scripts/crontab/prod /etc/cron.d/builder-prod-maint")


def manage_cmd(ctx, command):
    """Call a manage.py command."""
    with ctx.lcd(FLIGHTDECK_DIR):
        ctx.local("python2.6 manage.py %s" % command)
@task
def make_crons(ctx):
    with ctx.lcd(FLIGHTDECK_DIR):
        ctx.local("python2.6 ./scripts/crontab/make-crons.py")


def _git_checkout_tag(ctx, tag):
    ctx.local("git fetch -t origin")
    ctx.local("git checkout %s" % tag)
    ctx.local("git submodule sync")
    ctx.local("git submodule update --init --recursive")

def _rmpyc(ctx):
    ctx.local("rm `find . -name '*.pyc'`")

@task
def start_update(ctx, tag):
    """Updates code to `tag`"""
    disable_cron()
    with ctx.lcd(FLIGHTDECK_DIR):
        _git_checkout_tag(ctx, tag)
        _rmpyc(ctx)


@task
def update_flightdeck(ctx):
    """Deploys code to the webservers and restarts celery"""
    # BEGIN: The normal update/push cycle.
    make_crons()
    schematic()
    deploy_code()
    restart_celery()
    enable_cron()
    # END: The normal update/push cycle.

    # Run management commands like this:
    # manage_cmd(ctx, 'cmd')

    manage_cmd(ctx, 'cron update_package_activity')
    # manage_cmd(ctx, 'cron setup_mapping') 


