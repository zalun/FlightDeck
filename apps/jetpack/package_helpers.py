" Helpers for the package "

from base.shortcuts import get_object_with_related_or_404
from jetpack.models import Package, PackageRevision


def get_package_revision(id_name, type_id,
                         revision_number=None,
                         version_name=None, latest=False):
    """
    Return revision of the package
    """

    if not (revision_number or version_name):
        # get default revision - one linked via Package:version
        package = get_object_with_related_or_404(Package, id_number=id_name,
                                                 type=type_id)
        package_revision = package.latest if latest else package.version

    elif revision_number:
        # get version given by revision number
        package_revision = get_object_with_related_or_404(PackageRevision,
                            package__id_number=id_name, package__type=type_id,
                            revision_number=revision_number)
    elif version_name:
        # get version given by version name
        package_revision = get_object_with_related_or_404(PackageRevision,
                            package__id_number=id_name, package__type=type_id,
                            version_name=version_name)
    return package_revision
