from celery.decorators import task


@task(rate_limit='10/s')
def touch_a_file(filename):
    f = open(filename,'w')
    f.write('touched')
    f.close();

