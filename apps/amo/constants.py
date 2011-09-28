# XXX: We need to implement constants somehow
# Flightdeck <-> AMO integration statuses
STATUS_UPLOAD_SCHEDULED = -1
STATUS_UPLOAD_FAILED = -2
# Add-on and File statuses.
STATUS_NULL = 0
STATUS_UNREVIEWED = 1
STATUS_PENDING = 2
STATUS_NOMINATED = 3
STATUS_PUBLIC = 4
STATUS_DISABLED = 5
STATUS_LISTED = 6
STATUS_BETA = 7
STATUS_LITE = 8
STATUS_LITE_AND_NOMINATED = 9
STATUS_PURGATORY = 10  # A temporary home; bug 614686

STATUS_NAMES = {
    STATUS_UPLOAD_SCHEDULED: "Upload Scheduled",
    STATUS_UPLOAD_FAILED: "Upload Failed",
    STATUS_NULL: "Incomplete",
    STATUS_UNREVIEWED: "Unreviewed",
    STATUS_PENDING: "Pending",
    STATUS_NOMINATED: "Nominated",
    STATUS_PUBLIC: "Public",
    STATUS_DISABLED: "Disabled",
    STATUS_LISTED: "Listed",
    STATUS_BETA: "Beta",
    STATUS_LITE: "Preliminarily Reviewed",
    STATUS_LITE_AND_NOMINATED: "Lite and Nominated",
    STATUS_PURGATORY: "Purgatory",
}
