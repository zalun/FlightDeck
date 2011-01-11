{% load base_helpers %}
// edit/view package initiate
// {{ revision }}
//
// package specific
  // latest_url: '{{ revision.package.latest.get_absolute_url }}',
  id_number: '{{ revision.package.id_number|escapejs }}',
  full_name: '{{ revision.package.full_name|escapejs }}',
  name: '{{ revision.package.name|escapejs }}',
  // description: '',
  type: '{{ revision.package.type }}',
  package_author: '{{ revision.package.author }}',
  // url: '',
  license: '{{ revision.package.license }}',
  package_version_name: '{{ revision.package.version_name }}',
  version_url: '{{ revision.package.version.get_absolute_url }}',

// revision specific data
  revision_verion_name: '{{ revision.version_name }}',
  revision_number: '{{ revision.revision_number }}',
  // message: '', // commit message
  dependencies: {{ revision.get_dependencies_list_json|safe }},
  origin_url: '{{ revision.origin.get_absolute_url }}',
  revision_author: '{{ revision.author }}', modules: {{ revision.get_modules_list_json|safe }},
  attachments: {{ revision.get_attachments_list_json|safe }},
// Actions
  copy_url: '{{ revision.get_copy_url }}',
  tree: {{ tree|safe }}
