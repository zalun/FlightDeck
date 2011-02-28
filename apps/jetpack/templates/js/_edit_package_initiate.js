{% load base_helpers %}
// Actions
  switch_sdk_url: '{{ revision.get_switch_sdk_url }}',
  save_url: '{{ revision.get_save_url }}',
  add_module_url: '{{ revision.get_add_module_url }}',
  rename_module_url: '{{ revision.get_rename_module_url }}',
  remove_module_url: '{{ revision.get_remove_module_url }}',
  add_attachment_url: '{{ revision.get_add_attachment_url }}',
  upload_attachment_url: "{{ revision.get_upload_attachment_url }}",
  rename_attachment_url: '{{ revision.get_rename_attachment_url }}',
  remove_attachment_url: '{{ revision.get_remove_attachment_url }}',
  assign_library_url: '{{ revision.get_assign_library_url }}',
  remove_library_url: '{{ revision.get_remove_library_url }}',
  add_folder_url: '{{ revision.get_add_folder_url }}',
  remove_folder_url: '{{ revision.get_remove_folder_url }}',
  latest_dependencies_url: '{{ revision.get_latest_dependencies_url }}'
