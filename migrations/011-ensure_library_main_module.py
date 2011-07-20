from jetpack.models import PackageRevision

LIB_MODULE_MAIN = 'index'

def run(*args, **kwargs):
    libs = PackageRevision.objects.filter(package__type='l', module_main='main')
            .select_related('package', 'modules')

    libs.update(module_main=LIB_MODULE_MAIN)

    main_per_package = {}

    for revision in libs:
        if revision.modules.filter(filename=LIB_MODULE_MAIN).count() == 0:
            mod = main_per_package.get(revision.package_id)
            if not mod:
                mod = Module(filename=LIB_MODULE_MAIN, author=revision.author)
                mod.save()
                main_per_package[revision.package_id] = mod

            revision.modules.add(mod)
